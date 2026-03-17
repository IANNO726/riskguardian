"""
Trading Control Routes — Risk Lock with auto-close watcher
"""
from fastapi import APIRouter, HTTPException
import MetaTrader5 as mt5
import logging
import json
import os
import asyncio

router = APIRouter(tags=["Trading"])
logger = logging.getLogger(__name__)

STATE_FILE = os.path.join(os.path.dirname(__file__), ".trading_state.json")
_watcher_task: asyncio.Task | None = None


# ── State helpers ────────────────────────────────────────────────────────────

def _read_state() -> dict:
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except Exception:
        return {"locked": False, "positions_at_lock": [], "ends_at": None}


def _write_state(state: dict):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f)


# ── Close a single position (tries all filling modes) ───────────────────────

def _close_position(pos) -> bool:
    tick = mt5.symbol_info_tick(pos.symbol)
    if tick is None:
        logger.error(f"No tick for {pos.symbol}")
        return False

    price      = tick.bid if pos.type == mt5.ORDER_TYPE_BUY else tick.ask
    order_type = mt5.ORDER_TYPE_SELL if pos.type == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY

    for filling in [mt5.ORDER_FILLING_FOK, mt5.ORDER_FILLING_IOC, mt5.ORDER_FILLING_RETURN]:
        request = {
            "action":       mt5.TRADE_ACTION_DEAL,
            "position":     pos.ticket,
            "symbol":       pos.symbol,
            "volume":       pos.volume,
            "type":         order_type,
            "price":        price,
            "deviation":    50,
            "magic":        pos.magic,
            "type_time":    mt5.ORDER_TIME_GTC,
            "type_filling": filling,
        }
        result = mt5.order_send(request)
        if result is not None and result.retcode == mt5.TRADE_RETCODE_DONE:
            logger.info(f"✅ Closed ticket {pos.ticket} ({pos.symbol})")
            return True
        elif result is not None:
            logger.warning(f"Filling {filling} failed: retcode={result.retcode} {result.comment}")
        else:
            logger.warning(f"Filling {filling} failed: order_send=None — {mt5.last_error()}")

    logger.error(f"❌ All filling modes failed for ticket {pos.ticket}")
    return False


# ── Background watcher task ──────────────────────────────────────────────────

async def _watch_and_close():
    """
    Runs while locked. Every 3 seconds:
    - Checks if lock should still be active (time-based or manual)
    - Closes any position NOT in the allowed set
    """
    logger.info("🔒 Risk Lock watcher started")

    # Initialize MT5 once for the lifetime of the watcher
    if not mt5.initialize():
        logger.error(f"❌ MT5 init failed in watcher: {mt5.last_error()}")
        # Don't exit — keep retrying below
    else:
        logger.info("✅ MT5 initialized in watcher")

    while True:
        try:
            state = _read_state()

            if not state.get("locked"):
                logger.info("🔓 Lock lifted — watcher stopping")
                break

            # Auto-unlock if ends_at has elapsed
            ends_at_str = state.get("ends_at")
            if ends_at_str:
                from datetime import datetime, timezone
                try:
                    ends_at = datetime.fromisoformat(ends_at_str)
                    # Make timezone-aware comparison
                    now = datetime.now(timezone.utc)
                    if ends_at.tzinfo is None:
                        # Stored without tz — treat as UTC
                        ends_at = ends_at.replace(tzinfo=timezone.utc)
                    if now >= ends_at:
                        logger.info("⏰ Cooldown time elapsed — auto-unlocking")
                        state["locked"] = False
                        state["positions_at_lock"] = []
                        state["ends_at"] = None
                        _write_state(state)
                        break
                except Exception as e:
                    logger.warning(f"Could not parse ends_at: {e}")

            # Re-init MT5 if connection dropped
            if not mt5.terminal_info():
                logger.warning("MT5 connection lost — re-initializing")
                mt5.initialize()
                await asyncio.sleep(3)
                continue

            allowed_tickets = set(state.get("positions_at_lock", []))
            current         = mt5.positions_get() or []

            for pos in current:
                if pos.ticket not in allowed_tickets:
                    logger.warning(f"⚠️  New position detected while locked: {pos.ticket} {pos.symbol} — closing now")
                    _close_position(pos)

        except Exception as e:
            logger.error(f"Watcher loop error: {e}")

        await asyncio.sleep(3)

    logger.info("🔓 Risk Lock watcher stopped")


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/status")
async def trading_status():
    state = _read_state()
    return {
        "locked":  state.get("locked", False),
        "paused":  state.get("locked", False),
        "ends_at": state.get("ends_at"),
        "message": "Risk Lock ACTIVE" if state.get("locked") else "Trading normal",
    }


@router.post("/lock")
@router.post("/pause")
async def activate_risk_lock():
    global _watcher_task

    if not mt5.initialize():
        raise HTTPException(status_code=500, detail=f"MT5 not initialized: {mt5.last_error()}")

    state = _read_state()
    if state.get("locked"):
        # Already locked — make sure watcher is running
        if _watcher_task is None or _watcher_task.done():
            _watcher_task = asyncio.create_task(_watch_and_close())
        return {"success": True, "locked": True, "message": "Already locked — watcher ensured running"}

    # Snapshot current positions — these are ALLOWED to stay open
    current = mt5.positions_get() or []
    allowed = [p.ticket for p in current]

    state["locked"]             = True
    state["positions_at_lock"]  = allowed
    # ends_at is set by the cooldown system; trading.py respects it for auto-unlock
    # If you want a standalone timeout here too, set it:
    # from datetime import datetime, timedelta, timezone
    # state["ends_at"] = (datetime.now(timezone.utc) + timedelta(minutes=60)).isoformat()
    _write_state(state)

    # Start watcher (cancel old one first if somehow still running)
    if _watcher_task and not _watcher_task.done():
        _watcher_task.cancel()
    _watcher_task = asyncio.create_task(_watch_and_close())

    logger.info(f"🔒 Risk Lock ON — {len(allowed)} existing position(s) kept, new ones will be closed")
    return {
        "success":                    True,
        "locked":                     True,
        "paused":                     True,
        "existing_positions_allowed": len(allowed),
        "message": f"Risk Lock active — {len(allowed)} existing position(s) kept. New ones auto-closed.",
    }


@router.post("/unlock")
@router.post("/resume")
async def deactivate_risk_lock():
    global _watcher_task

    state = _read_state()
    state["locked"]            = False
    state["positions_at_lock"] = []
    state["ends_at"]           = None
    _write_state(state)

    # Watcher will stop on next iteration when it reads locked=False
    logger.info("🔓 Risk Lock OFF")
    return {"success": True, "locked": False, "paused": False, "message": "Risk Lock lifted"}


@router.post("/lock/with-duration")
async def activate_risk_lock_with_duration(minutes: int = 60):
    """
    Activate risk lock AND store ends_at so the watcher auto-unlocks
    when the cooldown period expires.
    """
    global _watcher_task

    if not mt5.initialize():
        raise HTTPException(status_code=500, detail=f"MT5 not initialized: {mt5.last_error()}")

    from datetime import datetime, timedelta, timezone

    current = mt5.positions_get() or []
    allowed = [p.ticket for p in current]
    ends_at = (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat()

    state = {
        "locked":            True,
        "positions_at_lock": allowed,
        "ends_at":           ends_at,
    }
    _write_state(state)

    if _watcher_task and not _watcher_task.done():
        _watcher_task.cancel()
    _watcher_task = asyncio.create_task(_watch_and_close())

    logger.info(f"🔒 Risk Lock ON for {minutes}min — {len(allowed)} position(s) kept")
    return {
        "success": True,
        "locked":  True,
        "ends_at": ends_at,
        "existing_positions_allowed": len(allowed),
        "message": f"Risk Lock active for {minutes} minutes",
    }