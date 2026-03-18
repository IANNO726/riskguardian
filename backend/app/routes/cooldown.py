from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, ForeignKey
from app.database.database import Base, get_db
from app.routes.auth_multi import get_current_user
from app.models.user import User
from pydantic import BaseModel
from datetime import datetime, timedelta, date
import asyncio
import json
import os
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

_AUTO_LOCK_CFG = os.path.join(os.path.dirname(__file__), ".auto_lock_config.json")
_auto_lock_task: asyncio.Task | None = None


# ── Model ─────────────────────────────────────────────────────
class CooldownSession(Base):
    __tablename__ = "cooldown_sessions"
    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"))
    reason          = Column(String, default="manual")
    started_at      = Column(DateTime, default=datetime.utcnow)
    ends_at         = Column(DateTime)
    is_active       = Column(Boolean, default=True)
    loss_at_trigger = Column(Float, default=0.0)
    notes           = Column(String, default="")


# ── Schemas ───────────────────────────────────────────────────
class StartCooldownRequest(BaseModel):
    minutes: int = 30
    reason: str = "manual"
    notes: str = ""

class CooldownStatus(BaseModel):
    active: bool
    reason: str = ""
    ends_at: str = ""
    minutes_remaining: int = 0
    message: str = ""


# ── Helper: fire alert safely (never crashes the main flow) ───
async def _fire_alert(alert_type, data: dict, user: User):
    """
    Dispatches a Telegram/Email alert based on the user's plan.
    Wrapped in try/except so a failed alert never breaks anything.
    """
    try:
        from app.alerts.alerts import dispatcher, AlertType
        await dispatcher.dispatch(
            alert_type=alert_type,
            data=data,
            plan=getattr(user, "plan", "free") or "free",
            telegram_chat_id=getattr(user, "telegram_chat_id", None),
            email=getattr(user, "email", None),
        )
    except Exception as e:
        logger.error(f"Alert dispatch failed (non-critical): {e}")


# ── Helper: internal HTTP calls using requests (not httpx) ────
async def _post_internal(url: str, json_data: dict, timeout: float = 5.0) -> bool:
    """
    Makes internal localhost POST calls using requests via run_in_executor.
    Replaces httpx for Windows compatibility.
    """
    try:
        import requests as _requests
        loop = asyncio.get_event_loop()
        resp = await loop.run_in_executor(None, lambda: _requests.post(
            url, json=json_data, timeout=timeout
        ))
        return resp.status_code < 300
    except Exception as e:
        logger.error(f"Internal POST to {url} failed: {e}")
        return False


# ── Existing Routes ────────────────────────────────────────────

@router.get("/status")
async def get_cooldown_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(CooldownSession).filter(
        CooldownSession.user_id == current_user.id,
        CooldownSession.is_active == True
    ).first()

    if not session:
        return {"active": False, "minutes_remaining": 0, "reason": "", "ends_at": "", "message": ""}

    now = datetime.utcnow()
    if now >= session.ends_at:
        session.is_active = False
        db.commit()
        return {"active": False, "minutes_remaining": 0, "reason": "", "ends_at": "", "message": ""}

    minutes_remaining = int((session.ends_at - now).total_seconds() / 60)
    return {
        "active":            True,
        "reason":            session.reason,
        "ends_at":           session.ends_at.isoformat(),
        "minutes_remaining": minutes_remaining,
        "message":           f"Cooldown active: {minutes_remaining} min remaining",
    }


@router.post("/start")
async def start_cooldown(
    req: StartCooldownRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Deactivate any existing cooldown
    db.query(CooldownSession).filter(
        CooldownSession.user_id == current_user.id,
        CooldownSession.is_active == True
    ).update({"is_active": False})

    ends_at = datetime.utcnow() + timedelta(minutes=req.minutes)
    session = CooldownSession(
        user_id   = current_user.id,
        reason    = req.reason,
        ends_at   = ends_at,
        notes     = req.notes,
        is_active = True,
    )
    db.add(session)
    db.commit()

    # ── Alert: manual cooldown started ────────────────────────
    unlock_time = ends_at.strftime("%H:%M UTC")
    from app.alerts.alerts import AlertType
    await _fire_alert(
        AlertType.CONSECUTIVE_LOSS_LOCK,
        {
            "account_name":  current_user.username,
            "losses":        "—",
            "cooldown_mins": req.minutes,
            "unlock_time":   unlock_time,
        },
        current_user,
    )

    return {
        "success": True,
        "message": f"Cooldown started for {req.minutes} minutes",
        "ends_at": ends_at.isoformat(),
        "reason":  req.reason,
    }


@router.post("/stop")
async def stop_cooldown(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(CooldownSession).filter(
        CooldownSession.user_id == current_user.id,
        CooldownSession.is_active == True
    ).update({"is_active": False})
    db.commit()
    return {"success": True, "message": "Cooldown cancelled"}


@router.get("/history")
async def get_cooldown_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sessions = db.query(CooldownSession).filter(
        CooldownSession.user_id == current_user.id
    ).order_by(CooldownSession.started_at.desc()).limit(10).all()

    return {"history": [
        {
            "id":         s.id,
            "reason":     s.reason,
            "started_at": s.started_at.isoformat(),
            "ends_at":    s.ends_at.isoformat(),
            "notes":      s.notes,
        }
        for s in sessions
    ]}


# ── Auto-lock config ───────────────────────────────────────────

def _read_auto_lock_config() -> dict:
    try:
        with open(_AUTO_LOCK_CFG) as f:
            return json.load(f)
    except Exception:
        return {"enabled": False, "loss_threshold_pct": 2.0, "cooldown_minutes": 60}


@router.get("/auto-lock/config")
async def get_auto_lock_config():
    return _read_auto_lock_config()


@router.post("/auto-lock/config")
async def save_auto_lock_config(config: dict):
    with open(_AUTO_LOCK_CFG, "w") as f:
        json.dump(config, f, indent=2)
    logger.info(f"Auto-lock config saved: {config}")
    return {"success": True, "config": config}


@router.post("/auto-lock/start-watcher")
async def start_auto_lock_watcher_endpoint():
    await _ensure_watcher_running()
    return {"success": True, "message": "Auto-lock watcher is running"}


# ── Auto-lock background watcher ───────────────────────────────
async def _auto_lock_watcher_loop(db_factory):
    from app.services.mt5_wrapper import get_mt5\nmt5 = get_mt5()
    from app.alerts.alerts import AlertType

    logger.info("🤖 Auto-lock watcher started")

    # Track which thresholds already fired — avoid spamming same alert
    _alerted_50: set  = set()
    _alerted_80: set  = set()
    _last_reset: date = date.today()

    while True:
        try:
            # Reset trackers at midnight
            today = date.today()
            if today != _last_reset:
                _alerted_50.clear()
                _alerted_80.clear()
                _last_reset = today

            cfg = _read_auto_lock_config()

            if not cfg.get("enabled", False):
                await asyncio.sleep(60)
                continue

            threshold_pct = float(cfg.get("loss_threshold_pct", 2.0))
            cooldown_mins = int(cfg.get("cooldown_minutes", 60))

            # ── MT5 data ──────────────────────────────────────
            if not mt5.initialize():
                await asyncio.sleep(60)
                continue

            account = mt5.account_info()
            if account is None:
                await asyncio.sleep(60)
                continue

            balance  = account.balance
            open_pnl = account.profit

            today_start  = datetime.combine(date.today(), datetime.min.time())
            deals        = mt5.history_deals_get(today_start, datetime.now()) or []
            closed_today = sum(
                d.profit for d in deals
                if getattr(d, "entry", -1) == 1 and d.type <= 1
            )

            total_daily_pnl = closed_today + open_pnl

            if total_daily_pnl >= 0 or balance <= 0:
                await asyncio.sleep(60)
                continue

            loss_pct    = abs(total_daily_pnl) / balance * 100
            daily_limit = balance * (threshold_pct / 100)
            remaining   = daily_limit - abs(total_daily_pnl)

            # ── Query all users ───────────────────────────────
            db = next(db_factory())
            try:
                users = db.query(User).filter(User.id != None).all()

                for user in users:

                    # ── 50% warning — Starter+ only, once per day ─────
                    if (
                        49 <= loss_pct < 51
                        and user.id not in _alerted_50
                        and getattr(user, "plan", "free") in ("starter", "pro", "enterprise")
                    ):
                        _alerted_50.add(user.id)
                        await _fire_alert(
                            AlertType.DAILY_LOSS_WARNING_50,
                            {
                                "account_name": user.username,
                                "loss":         abs(total_daily_pnl),
                                "limit":        daily_limit,
                                "remaining":    remaining,
                            },
                            user,
                        )

                    # ── 80% warning — all plans, once per day ─────────
                    if (
                        loss_pct >= threshold_pct * 0.8
                        and loss_pct < threshold_pct
                        and user.id not in _alerted_80
                    ):
                        _alerted_80.add(user.id)
                        await _fire_alert(
                            AlertType.DAILY_LOSS_WARNING_80,
                            {
                                "account_name": user.username,
                                "loss":         abs(total_daily_pnl),
                                "limit":        daily_limit,
                                "remaining":    max(remaining, 0),
                            },
                            user,
                        )

                    # ── Kill switch — full threshold breached ──────────
                    if loss_pct >= threshold_pct:
                        active = db.query(CooldownSession).filter(
                            CooldownSession.user_id == user.id,
                            CooldownSession.is_active == True
                        ).first()

                        if active:
                            continue  # already locked, don't double-fire

                        ends_at = datetime.utcnow() + timedelta(minutes=cooldown_mins)
                        new_session = CooldownSession(
                            user_id         = user.id,
                            reason          = "auto_loss_limit",
                            ends_at         = ends_at,
                            is_active       = True,
                            loss_at_trigger = round(total_daily_pnl, 2),
                        )
                        db.add(new_session)
                        db.commit()

                        logger.warning(
                            f"🤖 AUTO-LOCK triggered for {user.username}: "
                            f"daily loss {loss_pct:.2f}% ≥ {threshold_pct}%"
                        )

                        reset_time = ends_at.strftime("%H:%M UTC")

                        # ── Fire kill switch Telegram alert ───────────
                        await _fire_alert(
                            AlertType.KILL_SWITCH_FIRED,
                            {
                                "account_name": user.username,
                                "loss":         abs(total_daily_pnl),
                                "limit":        daily_limit,
                                "reason":       f"Daily loss reached {loss_pct:.1f}% of balance",
                                "reset_time":   reset_time,
                            },
                            user,
                        )

                        # ── Journal log (uses requests, not httpx) ─────
                        await _post_internal(
                            "http://localhost:8000/api/v1/journal/lock-event",
                            {
                                "reason":                "auto_loss_limit",
                                "duration_minutes":      cooldown_mins,
                                "triggered_by":          "auto",
                                "daily_loss_at_trigger": round(total_daily_pnl, 2),
                                "notes": (
                                    f"Auto-lock triggered: daily loss reached "
                                    f"${abs(total_daily_pnl):.2f} "
                                    f"({loss_pct:.1f}% of ${balance:.2f} balance), "
                                    f"exceeding the {threshold_pct}% threshold."
                                ),
                            },
                        )

                        # ── MT5 lock watcher (uses requests, not httpx) ─
                        await _post_internal(
                            f"http://localhost:8000/api/v1/trading/lock/with-duration"
                            f"?minutes={cooldown_mins}",
                            {},
                        )

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Auto-lock watcher loop error: {e}")

        await asyncio.sleep(60)


async def _ensure_watcher_running():
    global _auto_lock_task
    from app.database.database import get_db as _get_db
    if _auto_lock_task is None or _auto_lock_task.done():
        _auto_lock_task = asyncio.create_task(_auto_lock_watcher_loop(_get_db))
        logger.info("🤖 Auto-lock watcher task created")


async def start_auto_lock_watcher():
    await _ensure_watcher_running()


