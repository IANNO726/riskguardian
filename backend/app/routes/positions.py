"""
Open Positions Routes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.services.mt5_wrapper import get_mt5\nmt5 = get_mt5()
import logging
from app.database.database import get_db

router = APIRouter(tags=["Positions"])
logger = logging.getLogger(__name__)


class ModifyPositionRequest(BaseModel):
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None


def _close_position_request(pos) -> dict | None:
    """
    Try all 3 filling modes in order until one works.
    Returns the successful result or None.
    """
    tick = mt5.symbol_info_tick(pos.symbol)
    if tick is None:
        return None

    price      = tick.bid if pos.type == mt5.ORDER_TYPE_BUY else tick.ask
    order_type = mt5.ORDER_TYPE_SELL if pos.type == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY

    # Try all filling modes — brokers differ (Deriv/Jump uses FOK or RETURN)
    filling_modes = [
        mt5.ORDER_FILLING_FOK,
        mt5.ORDER_FILLING_IOC,
        mt5.ORDER_FILLING_RETURN,
    ]

    for filling in filling_modes:
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
            logger.info(f"Closed ticket {pos.ticket} with filling mode {filling}")
            return result
        elif result is not None:
            logger.warning(f"Filling {filling} failed for {pos.ticket}: retcode {result.retcode} — {result.comment}")

    return None  # all modes failed


@router.get("/")
async def get_positions(account_id: Optional[int] = None, db: Session = Depends(get_db)):
    try:
        if not mt5.initialize():
            return {"positions": [], "total": 0, "total_profit": 0, "error": "MT5 not initialized"}

        positions = mt5.positions_get()
        if positions is None:
            return {"positions": [], "total": 0, "total_profit": 0}

        result = []
        total_profit = 0
        for pos in positions:
            total_profit += pos.profit
            result.append({
                "id": pos.ticket, "ticket": pos.ticket, "symbol": pos.symbol,
                "type": "BUY" if pos.type == 0 else "SELL",
                "volume": pos.volume, "price_open": pos.price_open,
                "price_current": pos.price_current, "open_time": pos.time,
                "profit": pos.profit,
                "commission": pos.commission if hasattr(pos, 'commission') else 0,
                "swap": pos.swap, "sl": pos.sl, "tp": pos.tp,
                "stop_loss": pos.sl, "take_profit": pos.tp, "risk_reward_ratio": 0
            })

        return {"positions": result, "total": len(result), "total_profit": total_profit}

    except Exception as e:
        logger.error(f"Error getting positions: {e}")
        return {"positions": [], "total": 0, "total_profit": 0, "error": str(e)}


@router.post("/close-all")
async def close_all_positions():
    """Close every open MT5 position, auto-detecting the broker's filling mode"""
    try:
        if not mt5.initialize():
            raise HTTPException(status_code=500, detail="MT5 not initialized")

        positions = mt5.positions_get()
        if positions is None or len(positions) == 0:
            return {"success": True, "closed": 0, "failed": 0, "message": "No open positions to close"}

        closed = 0
        failed = 0
        errors = []

        for pos in positions:
            result = _close_position_request(pos)
            if result is not None:
                logger.info(f"Closed {pos.ticket} {pos.symbol} profit={pos.profit}")
                closed += 1
            else:
                msg = f"Ticket {pos.ticket} ({pos.symbol}): all filling modes failed — {mt5.last_error()}"
                logger.error(msg)
                errors.append(msg)
                failed += 1

        return {
            "success": failed == 0,
            "closed":  closed,
            "failed":  failed,
            "errors":  errors,
            "message": f"Closed {closed} position(s)" + (f", {failed} failed" if failed else ""),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"close-all error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{position_id}/close")
async def close_position(position_id: int):
    """Close a single position by ticket, auto-detecting filling mode"""
    try:
        if not mt5.initialize():
            raise HTTPException(status_code=500, detail="MT5 not initialized")

        positions = mt5.positions_get(ticket=position_id)
        if not positions:
            raise HTTPException(status_code=404, detail="Position not found")

        result = _close_position_request(positions[0])
        if result is None:
            raise HTTPException(status_code=400, detail=f"Close failed — all filling modes rejected by broker. Last error: {mt5.last_error()}")

        return {"success": True, "ticket": position_id, "message": "Position closed"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{position_id}/modify")
async def modify_position(position_id: int, body: ModifyPositionRequest):
    try:
        if not mt5.initialize():
            raise HTTPException(status_code=500, detail="MT5 not initialized")

        positions = mt5.positions_get(ticket=position_id)
        if not positions:
            raise HTTPException(status_code=404, detail="Position not found")

        pos    = positions[0]
        new_sl = body.stop_loss   if body.stop_loss   is not None else pos.sl
        new_tp = body.take_profit if body.take_profit is not None else pos.tp

        request = {
            "action": mt5.TRADE_ACTION_SLTP, "position": position_id,
            "symbol": pos.symbol, "sl": new_sl, "tp": new_tp,
            "magic": pos.magic, 
        }

        result = mt5.order_send(request)
        if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
            detail = result.comment if result else str(mt5.last_error())
            raise HTTPException(status_code=400, detail=f"Modify failed: {detail}")

        return {"success": True, "ticket": position_id, "new_sl": new_sl, "new_tp": new_tp}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{position_id}")
async def get_position(position_id: int, db: Session = Depends(get_db)):
    try:
        if not mt5.initialize():
            return {"error": "MT5 not initialized"}
        positions = mt5.positions_get(ticket=position_id)
        if not positions:
            return {"error": "Position not found"}
        pos = positions[0]
        return {
            "id": pos.ticket, "ticket": pos.ticket, "symbol": pos.symbol,
            "type": "BUY" if pos.type == 0 else "SELL",
            "volume": pos.volume, "price_open": pos.price_open,
            "price_current": pos.price_current, "profit": pos.profit,
        }
    except Exception as e:
        return {"error": str(e)}


