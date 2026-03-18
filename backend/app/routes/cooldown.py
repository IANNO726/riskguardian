from fastapi import APIRouter, Depends
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
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    reason = Column(String, default="manual")
    started_at = Column(DateTime, default=datetime.utcnow)
    ends_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    loss_at_trigger = Column(Float, default=0.0)
    notes = Column(String, default="")


# ── Schemas ───────────────────────────────────────────────────
class StartCooldownRequest(BaseModel):
    minutes: int = 30
    reason: str = "manual"
    notes: str = ""


# ── Helper ────────────────────────────────────────────────────
async def _fire_alert(alert_type, data: dict, user: User):
    try:
        from app.alerts.alerts import dispatcher
        await dispatcher.dispatch(
            alert_type=alert_type,
            data=data,
            plan=getattr(user, "plan", "free") or "free",
            telegram_chat_id=getattr(user, "telegram_chat_id", None),
            email=getattr(user, "email", None),
        )
    except Exception as e:
        logger.error(f"Alert dispatch failed: {e}")


async def _post_internal(url: str, json_data: dict):
    try:
        import requests
        loop = asyncio.get_event_loop()
        resp = await loop.run_in_executor(None, lambda: requests.post(url, json=json_data))
        return resp.status_code < 300
    except Exception as e:
        logger.error(f"Internal POST failed: {e}")
        return False


# ── Routes ────────────────────────────────────────────────────
@router.get("/status")
async def get_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(CooldownSession).filter(
        CooldownSession.user_id == current_user.id,
        CooldownSession.is_active == True
    ).first()

    if not session:
        return {"active": False}

    now = datetime.utcnow()
    if now >= session.ends_at:
        session.is_active = False
        db.commit()
        return {"active": False}

    minutes = int((session.ends_at - now).total_seconds() / 60)
    return {"active": True, "minutes_remaining": minutes}


@router.post("/start")
async def start(req: StartCooldownRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(CooldownSession).filter(
        CooldownSession.user_id == current_user.id,
        CooldownSession.is_active == True
    ).update({"is_active": False})

    ends_at = datetime.utcnow() + timedelta(minutes=req.minutes)

    session = CooldownSession(
        user_id=current_user.id,
        reason=req.reason,
        ends_at=ends_at,
        is_active=True
    )

    db.add(session)
    db.commit()

    return {"success": True, "ends_at": ends_at.isoformat()}


@router.post("/stop")
async def stop(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(CooldownSession).filter(
        CooldownSession.user_id == current_user.id,
        CooldownSession.is_active == True
    ).update({"is_active": False})
    db.commit()
    return {"success": True}


# ── AUTO LOCK WATCHER ─────────────────────────────────────────
async def _auto_lock_watcher_loop(db_factory):
    from app.services.mt5_wrapper import get_mt5
    from app.alerts.alerts import AlertType

    mt5 = get_mt5()

    logger.info("Auto-lock watcher started")

    while True:
        try:
            if not mt5.initialize():
                await asyncio.sleep(60)
                continue

            account = mt5.account_info()
            if not account:
                await asyncio.sleep(60)
                continue

            balance = account.balance
            pnl = account.profit

            if pnl >= 0:
                await asyncio.sleep(60)
                continue

            db = next(db_factory())
            users = db.query(User).all()

            for user in users:
                loss_pct = abs(pnl) / balance * 100

                if loss_pct >= 2:
                    existing = db.query(CooldownSession).filter(
                        CooldownSession.user_id == user.id,
                        CooldownSession.is_active == True
                    ).first()

                    if existing:
                        continue

                    ends_at = datetime.utcnow() + timedelta(minutes=60)

                    session = CooldownSession(
                        user_id=user.id,
                        reason="auto",
                        ends_at=ends_at,
                        is_active=True
                    )

                    db.add(session)
                    db.commit()

                    await _fire_alert(
                        AlertType.KILL_SWITCH_FIRED,
                        {"account_name": user.username},
                        user
                    )

            db.close()

        except Exception as e:
            logger.error(f"Watcher error: {e}")

        await asyncio.sleep(60)


async def _ensure_watcher_running():
    global _auto_lock_task
    from app.database.database import get_db

    if _auto_lock_task is None or _auto_lock_task.done():
        _auto_lock_task = asyncio.create_task(_auto_lock_watcher_loop(get_db))


async def start_auto_lock_watcher():
    await _ensure_watcher_running()



