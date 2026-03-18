"""
trial_scheduler.py
Daily Celery task to expire trials.
Add to your existing celery beat schedule or run standalone.
"""
from celery import Celery
from celery.schedules import crontab
import os, logging

logger = logging.getLogger(__name__)

CELERY_BROKER  = os.getenv("CELERY_BROKER_URL",  "amqp://guest:guest@localhost:5672//")
CELERY_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

celery_app = Celery("trial_tasks", broker=CELERY_BROKER, backend=CELERY_BACKEND)

celery_app.conf.beat_schedule = {
    "expire-trials-daily": {
        "task":     "app.billing.trial_scheduler.expire_trials_task",
        "schedule": crontab(hour=0, minute=0),   # midnight UTC daily
    },
}


@celery_app.task(name="app.billing.trial_scheduler.expire_trials_task")
def expire_trials_task():
    from app.database.database import SessionLocal
    from app.billing.trial import expire_trials
    db   = SessionLocal()
    try:
        count = expire_trials(db)
        logger.info(f"✅ Expired {count} trials")
        return count
    finally:
        db.close()



