"""
email_scheduler.py
Celery tasks for drip email sequences.
- Day 3 nudge
- Day 7 upgrade push
- Weekly Monday digest
"""

import logging
from datetime import datetime, timedelta
from celery import Celery
from celery.schedules import crontab
import os
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

CELERY_BROKER = os.getenv("CELERY_BROKER_URL", "amqp://guest:guest@localhost:5672//")
CELERY_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

celery_app = Celery("riskguardian_emails", broker=CELERY_BROKER, backend=CELERY_BACKEND)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # ── Beat schedule — weekly digest every Monday 8am UTC ────
    beat_schedule={
        "weekly-digest-monday": {
            "task": "app.emails.email_scheduler.send_weekly_digests",
            "schedule": crontab(hour=8, minute=0, day_of_week=1),
        },
        "check-day3-nudges": {
            "task": "app.emails.email_scheduler.send_pending_day3_nudges",
            "schedule": crontab(hour=9, minute=0),   # runs daily at 9am UTC
        },
        "check-day7-upgrades": {
            "task": "app.emails.email_scheduler.send_pending_day7_upgrades",
            "schedule": crontab(hour=9, minute=30),  # runs daily at 9:30am UTC
        },
    },
)


# ── Task: send welcome email immediately ──────────────────────
@celery_app.task(name="app.emails.email_scheduler.send_welcome_email_task", bind=True, max_retries=3)
def send_welcome_email_task(self, user_id: int, email: str, username: str):
    """Called right after a user signs up."""
    try:
        from app.emails.email_service import send_welcome_email
        success = send_welcome_email(email, username)
        if success:
            _mark_email_sent(user_id, "welcome")
            logger.info(f"✅ Welcome email sent to {email}")
        else:
            raise Exception("send_welcome_email returned False")
    except Exception as exc:
        logger.error(f"❌ Welcome email failed for {email}: {exc}")
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))


# ── Task: Day 3 nudge batch ───────────────────────────────────
@celery_app.task(name="app.emails.email_scheduler.send_pending_day3_nudges")
def send_pending_day3_nudges():
    """Find all users who signed up 3 days ago and haven't got a Day 3 email yet."""
    from app.database.database import SessionLocal
    from app.models.user import User
    from app.emails.email_service import send_day3_nudge_email

    db   = SessionLocal()
    sent = 0
    try:
        three_days_ago = datetime.utcnow() - timedelta(days=3)
        window_start   = three_days_ago.replace(hour=0,  minute=0,  second=0)
        window_end     = three_days_ago.replace(hour=23, minute=59, second=59)

        users = db.query(User).filter(
            User.created_at >= window_start,
            User.created_at <= window_end,
            User.email_day3_sent == False,   # noqa: E712
            User.email_unsubscribed == False, # noqa: E712
        ).all()

        for user in users:
            try:
                if send_day3_nudge_email(user.email, user.username):
                    user.email_day3_sent = True
                    db.commit()
                    sent += 1
                    logger.info(f"📧 Day 3 nudge sent to {user.email}")
            except Exception as e:
                logger.error(f"Day 3 nudge failed for {user.email}: {e}")

    finally:
        db.close()
    logger.info(f"Day 3 nudge batch complete — {sent} sent")


# ── Task: Day 7 upgrade push batch ───────────────────────────
@celery_app.task(name="app.emails.email_scheduler.send_pending_day7_upgrades")
def send_pending_day7_upgrades():
    """Find all free-plan users who signed up 7 days ago for upgrade push."""
    from app.database.database import SessionLocal
    from app.models.user import User
    from app.emails.email_service import send_day7_upgrade_email

    db   = SessionLocal()
    sent = 0
    try:
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        window_start   = seven_days_ago.replace(hour=0,  minute=0,  second=0)
        window_end     = seven_days_ago.replace(hour=23, minute=59, second=59)

        users = db.query(User).filter(
            User.created_at >= window_start,
            User.created_at <= window_end,
            User.plan == "free",              # only free users
            User.email_day7_sent == False,    # noqa: E712
            User.email_unsubscribed == False, # noqa: E712
        ).all()

        for user in users:
            try:
                if send_day7_upgrade_email(user.email, user.username):
                    user.email_day7_sent = True
                    db.commit()
                    sent += 1
                    logger.info(f"📧 Day 7 upgrade email sent to {user.email}")
            except Exception as e:
                logger.error(f"Day 7 email failed for {user.email}: {e}")

    finally:
        db.close()
    logger.info(f"Day 7 upgrade batch complete — {sent} sent")


# ── Task: Weekly digest batch (every Monday) ──────────────────
@celery_app.task(name="app.emails.email_scheduler.send_weekly_digests")
def send_weekly_digests():
    """Send weekly stats digest to all active users."""
    from app.database.database import SessionLocal
    from app.models.user import User
    from app.emails.email_service import send_weekly_digest_email

    db   = SessionLocal()
    sent = 0
    try:
        users = db.query(User).filter(
            User.email_unsubscribed == False,  # noqa: E712
            User.is_active == True,            # noqa: E712
        ).all()

        for user in users:
            try:
                stats = _get_weekly_stats(db, user)
                if send_weekly_digest_email(user.email, user.username, stats):
                    sent += 1
                    logger.info(f"📧 Weekly digest sent to {user.email}")
            except Exception as e:
                logger.error(f"Weekly digest failed for {user.email}: {e}")

    finally:
        db.close()
    logger.info(f"Weekly digest batch complete — {sent} sent")


# ── Helpers ───────────────────────────────────────────────────
def _mark_email_sent(user_id: int, email_type: str):
    """Mark an email as sent in the DB."""
    try:
        from app.database.database import SessionLocal
        from app.models.user import User
        db = SessionLocal()
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            if email_type == "welcome": user.email_welcome_sent = True
            db.commit()
        db.close()
    except Exception as e:
        logger.error(f"Could not mark email sent: {e}")


def _get_weekly_stats(db, user) -> dict:
    """
    Build weekly stats dict for the digest email.
    Pulls from trade history for last 7 days.
    Returns safe defaults if data unavailable.
    """
    try:
        from app.models.trade import Trade
        from sqlalchemy import func

        week_ago = datetime.utcnow() - timedelta(days=7)
        trades = db.query(Trade).filter(
            Trade.user_id == user.id,
            Trade.closed_at >= week_ago,
        ).all()

        if not trades:
            return {
                "weekly_pnl": 0, "weekly_pnl_pct": 0, "total_trades": 0,
                "win_rate": 0, "risk_locks_used": 0,
                "best_day": "No trades", "worst_day": "No trades", "risk_score": 0,
            }

        total_pnl  = sum(t.profit for t in trades if t.profit is not None)
        wins       = [t for t in trades if (t.profit or 0) > 0]
        win_rate   = (len(wins) / len(trades) * 100) if trades else 0

        # Group by day to find best/worst
        from collections import defaultdict
        daily_pnl: dict = defaultdict(float)
        for t in trades:
            day = t.closed_at.strftime("%a %b %d") if t.closed_at else "Unknown"
            daily_pnl[day] += t.profit or 0

        best_day_key  = max(daily_pnl, key=daily_pnl.get) if daily_pnl else "N/A"
        worst_day_key = min(daily_pnl, key=daily_pnl.get) if daily_pnl else "N/A"
        best_val      = daily_pnl.get(best_day_key, 0)
        worst_val     = daily_pnl.get(worst_day_key, 0)

        # Count risk lock events this week
        try:
            from app.models.journal import JournalLockEvent
            locks_used = db.query(func.count(JournalLockEvent.id)).filter(
                JournalLockEvent.user_id == user.id,
                JournalLockEvent.created_at >= week_ago,
            ).scalar() or 0
        except Exception:
            locks_used = 0

        return {
            "weekly_pnl":       total_pnl,
            "weekly_pnl_pct":   (total_pnl / max(abs(total_pnl), 1)) * 100,
            "total_trades":     len(trades),
            "win_rate":         win_rate,
            "risk_locks_used":  locks_used,
            "best_day":         f"{best_day_key} (+${best_val:.2f})" if best_val > 0 else best_day_key,
            "worst_day":        f"{worst_day_key} (-${abs(worst_val):.2f})" if worst_val < 0 else worst_day_key,
            "risk_score":       min(100, max(0, int(100 - win_rate))),
        }

    except Exception as e:
        logger.error(f"Could not build weekly stats for {user.id}: {e}")
        return {
            "weekly_pnl": 0, "weekly_pnl_pct": 0, "total_trades": 0,
            "win_rate": 0, "risk_locks_used": 0,
            "best_day": "N/A", "worst_day": "N/A", "risk_score": 0,
        }
