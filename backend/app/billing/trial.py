"""
trial.py
Backend routes for the 7-day free Pro trial system.
Mount in main.py: app.include_router(trial_router, prefix="/api/v1/billing")

Scheduler runs automatically in the background (no Celery needed):
  - Every 1 hour: expire_trials()         → downgrades expired users, sends expiry email + Telegram
  - Every 1 hour: send_trial_nudge_emails() → fires day3 nudge and day7 upgrade emails
  - Every 1 hour: send_trial_expiry_warnings() → sends "24hrs left" Telegram alert
"""

import asyncio
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db, SessionLocal
from app.models.user import User
from app.services.auth_service import get_current_user

logger = logging.getLogger(__name__)
trial_router = APIRouter(tags=["Trial"])

TRIAL_DAYS = 7
TRIAL_PLAN = "pro"


# ══════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════

# ── Start trial ───────────────────────────────────────────────
@trial_router.post("/start-trial")
def start_trial(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    if current_user.trial_used:
        raise HTTPException(400, "You have already used your free trial.")

    if current_user.plan not in ("free", None):
        raise HTTPException(400, f"You are already on the {current_user.plan} plan.")

    if (
        current_user.trial_ends_at and
        current_user.trial_ends_at > datetime.utcnow()
    ):
        raise HTTPException(400, "You already have an active trial.")

    trial_ends = datetime.utcnow() + timedelta(days=TRIAL_DAYS)
    current_user.plan          = TRIAL_PLAN
    current_user.trial_ends_at = trial_ends
    current_user.trial_used    = True
    current_user.trial_plan    = TRIAL_PLAN
    db.commit()
    db.refresh(current_user)

    # ✅ Trial-start email with personal Telegram connect link
    try:
        import os, threading
        from app.routes.telegram import generate_connect_link
        from app.emails.email_service import send_trial_started_email

        FRONTEND_URL = os.getenv("FRONTEND_URL", "http://192.168.43.131:3000")
        tg_link = generate_connect_link(current_user.id) if not current_user.telegram_chat_id else ""

        threading.Thread(
            target=send_trial_started_email,
            args=(current_user.email, current_user.username, TRIAL_DAYS, tg_link),
            daemon=True,
        ).start()
    except Exception:
        pass

    logger.info(f"✅ Trial started for {current_user.username} until {trial_ends}")
    return {
        "success":    True,
        "message":    f"Your {TRIAL_DAYS}-day Pro trial is now active!",
        "plan":       TRIAL_PLAN,
        "trial_ends": trial_ends.isoformat(),
        "days_left":  TRIAL_DAYS,
    }


# ── Trial status ──────────────────────────────────────────────
@trial_router.get("/trial-status")
def trial_status(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    now    = datetime.utcnow()
    active = bool(
        current_user.trial_ends_at and
        current_user.trial_ends_at > now and
        current_user.plan == TRIAL_PLAN
    )
    days_left  = 0
    hours_left = 0
    if active and current_user.trial_ends_at:
        diff       = current_user.trial_ends_at - now
        days_left  = diff.days
        hours_left = diff.seconds // 3600

    return {
        "trial_active": active,
        "trial_used":   bool(current_user.trial_used),
        "trial_ends":   current_user.trial_ends_at.isoformat() if current_user.trial_ends_at else None,
        "days_left":    days_left,
        "hours_left":   hours_left,
        "plan":         current_user.plan,
    }


# ══════════════════════════════════════════════════════════════
# SCHEDULER TASKS  (run in background, no Celery needed)
# ══════════════════════════════════════════════════════════════

def expire_trials(db: Session) -> int:
    """
    Downgrade all users whose trial has expired.
    Sends expiry email + Telegram message.
    Called every hour by the background scheduler.
    """
    now     = datetime.utcnow()
    expired = db.query(User).filter(
        User.trial_ends_at != None,   # noqa
        User.trial_ends_at <= now,
        User.plan == TRIAL_PLAN,
        User.trial_used == True,      # noqa
    ).all()

    for user in expired:
        user.plan = "free"
        db.commit()

        # Expiry email
        try:
            import threading
            from app.emails.email_service import send_trial_expired_email
            threading.Thread(
                target=send_trial_expired_email,
                args=(user.email, user.username),
                daemon=True,
            ).start()
        except Exception:
            pass

        # ✅ Telegram expiry alert
        if user.telegram_chat_id:
            try:
                import os, threading
                FRONTEND_URL = os.getenv("FRONTEND_URL", "http://192.168.43.131:3000")
                asyncio.create_task(_send_telegram(
                    user.telegram_chat_id,
                    f"⏰ <b>Your Pro Trial Has Expired</b>\n\n"
                    f"Hey {user.username}, your 7-day Pro trial has ended and your account "
                    f"has been moved back to the Free plan.\n\n"
                    f"Upgrade now to keep your Telegram alerts, AI journal, and prop firm profiles:\n"
                    f"👉 {FRONTEND_URL}/#/app/settings\n\n"
                    f"— RiskGuardian 🛡️"
                ))
            except Exception:
                pass

        logger.info(f"⏰ Trial expired for {user.username} — downgraded to free")

    return len(expired)


def send_trial_nudge_emails(db: Session) -> int:
    """
    Send day-3 nudge and day-7 upgrade emails to users mid-trial.
    Checks email_day3_sent / email_day7_sent flags to avoid duplicates.
    Called every hour by the background scheduler.
    """
    now   = datetime.utcnow()
    count = 0

    active_trial_users = db.query(User).filter(
        User.trial_ends_at != None,   # noqa
        User.trial_ends_at > now,
        User.plan == TRIAL_PLAN,
        User.trial_used == True,      # noqa
    ).all()

    for user in active_trial_users:
        if not user.trial_ends_at:
            continue

        days_elapsed = (now - (user.trial_ends_at - timedelta(days=TRIAL_DAYS))).days

        # Day 3 nudge
        if days_elapsed >= 3 and not user.email_day3_sent:
            try:
                import threading
                from app.emails.email_service import send_day3_nudge_email
                threading.Thread(
                    target=send_day3_nudge_email,
                    args=(user.email, user.username),
                    daemon=True,
                ).start()
                user.email_day3_sent = True
                db.commit()
                count += 1
                logger.info(f"📧 Day-3 nudge sent to {user.username}")
            except Exception as e:
                logger.error(f"Day-3 nudge failed for {user.username}: {e}")

        # Day 7 upgrade push
        if days_elapsed >= 7 and not user.email_day7_sent:
            try:
                import threading
                from app.emails.email_service import send_day7_upgrade_email
                threading.Thread(
                    target=send_day7_upgrade_email,
                    args=(user.email, user.username),
                    daemon=True,
                ).start()
                user.email_day7_sent = True
                db.commit()
                count += 1
                logger.info(f"📧 Day-7 upgrade push sent to {user.username}")
            except Exception as e:
                logger.error(f"Day-7 push failed for {user.username}: {e}")

    return count


def send_trial_expiry_warnings(db: Session) -> int:
    """
    Send a Telegram '24 hours left' warning to users whose trial
    expires within the next 24 hours and haven't been warned yet.
    Called every hour by the background scheduler.
    """
    import os
    now        = datetime.utcnow()
    in_24hrs   = now + timedelta(hours=24)
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://192.168.43.131:3000")
    count      = 0

    expiring_soon = db.query(User).filter(
        User.trial_ends_at != None,        # noqa
        User.trial_ends_at > now,
        User.trial_ends_at <= in_24hrs,
        User.plan == TRIAL_PLAN,
        User.trial_used == True,           # noqa
        User.telegram_chat_id != None,     # noqa
    ).all()

    for user in expiring_soon:
        # Use email_day7_sent as a proxy flag to avoid duplicate 24hr warnings
        # (day7 email fires at same time — if sent, warning already covered)
        if user.email_day7_sent:
            continue
        try:
            asyncio.create_task(_send_telegram(
                user.telegram_chat_id,
                f"⚠️ <b>Your Pro Trial Expires in 24 Hours</b>\n\n"
                f"Hey {user.username}! Your 7-day Pro trial ends tomorrow.\n\n"
                f"Don't lose access to:\n"
                f"• 📊 AI Trade Journal\n"
                f"• ✈️ Telegram Alerts (this chat!)\n"
                f"• 🏢 Prop Firm Profiles\n"
                f"• ⚡ Advanced Risk Rules\n\n"
                f"Upgrade now and keep everything:\n"
                f"👉 {FRONTEND_URL}/#/app/settings\n\n"
                f"— RiskGuardian 🛡️"
            ))
            count += 1
            logger.info(f"⚠️ 24hr expiry warning sent via Telegram to {user.username}")
        except Exception as e:
            logger.error(f"24hr Telegram warning failed for {user.username}: {e}")

    return count


async def _send_telegram(chat_id: str, text: str) -> None:
    """Fire-and-forget Telegram message from sync scheduler context."""
    import os
    import httpx
    BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not BOT_TOKEN or not chat_id:
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
                json={
                    "chat_id":    chat_id,
                    "text":       text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                },
            )
    except Exception as exc:
        logger.error("Scheduler Telegram send failed: %s", exc)


# ══════════════════════════════════════════════════════════════
# BACKGROUND SCHEDULER  (pure asyncio, no Celery/Redis needed)
# ══════════════════════════════════════════════════════════════

async def start_trial_scheduler():
    """
    Lightweight background scheduler — runs every hour.
    Replaces Celery for trial management tasks.
    Add to main.py lifespan:

        from app.billing.trial import start_trial_scheduler
        asyncio.create_task(start_trial_scheduler())
    """
    logger.info("⏰ Trial scheduler started")
    while True:
        try:
            db = SessionLocal()
            expired = expire_trials(db)
            nudged  = send_trial_nudge_emails(db)
            warned  = send_trial_expiry_warnings(db)
            db.close()

            if expired or nudged or warned:
                logger.info(
                    f"⏰ Trial scheduler: {expired} expired, "
                    f"{nudged} nudges sent, {warned} 24hr warnings sent"
                )
        except Exception as e:
            logger.error(f"Trial scheduler error: {e}")

        await asyncio.sleep(3600)  # run every hour



