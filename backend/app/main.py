from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import logging
import uvicorn
import asyncio
import os
import threading
import time

# ✅ SAFE MT5 IMPORT (NO CRASH ON RENDER)
from app.services.mt5_wrapper import get_mt5
mt5 = get_mt5()

from app.database.database import init_db
from app.services.journal_sync import sync_mt5_trades


# ================= REGISTER MODELS =================

from app.models.user import User, Subscription
from app.models.broker import BrokerConnection
from app.models.risk_rule import RiskRule
from app.models.alert_setting import AlertSetting
from app.models.ai_setting import AISetting
from app.models.journal import JournalEntry


# ================= ROUTERS =================

from app.routes.setup import router as setup_router
from app.routes.auth import router as auth_router
from app.routes.accounts import router as accounts_router
from app.routes.risk import router as risk_router
from app.routes.positions import router as positions_router
from app.routes.trades import router as trades_router
from app.routes.rules import router as rules_router
from app.routes.alerts import router as alerts_router
from app.routes.ws import router as ws_router
from app.routes.analytics import router as analytics_router
from app.routes.journal import router as journal_router
from app.routes.settings import router as settings_router
from app.routes.risk_status import router as risk_status_router
from app.routes.trading import router as trading_router
from app.routes.reports import router as reports_router
from app.routes.alerts_live import router as alerts_live_router
from app.routes.platforms import router as platforms_router
from app.routes.auth_multi import router as auth_multi_router
from app.routes.accounts_multi import router as accounts_multi_router
from app.routes.admin import router as admin_router
from app.routes.founder import router as founder_router
from app.routes.founder_users import router as founder_users_router
from app.billing.trial import trial_router, start_trial_scheduler
from app.routes.telegram import router as telegram_router
from app.routes.admin_stream import router as admin_stream_router
from app.routes.subscription import router as subscription_router, create_stripe_products
from app.routes.billing import router as billing_router
from app.routes.cooldown import router as cooldown_router, start_auto_lock_watcher
from app.routes.prop_firms import router as prop_firms_router
from app.routes.risk_rules_engine import router as risk_rules_router
from app.routes.white_label import router as white_label_router
from app.routes.api_webhooks import router as api_webhooks_router
from app.routes.team_management import router as team_router
from app.routes.integrations import router as integrations_router
from app.routes.risk_engine import router as risk_engine_router
from app.routes.simulator import router as simulator_router

from app.routes.news_calendar import router as news_calendar_router
from app.routes.weekly_report import router as weekly_report_router
from app.routes.portfolio_tracker import router as portfolio_router

from app.routes.weekly_report import start_scheduler as start_weekly_report_scheduler
from app.database.database import SessionLocal


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ================= MT5 CONFIG =================

MT5_LOGIN    = int(os.getenv("MT5_ACCOUNT_LOGIN", "0"))
MT5_PASSWORD = os.getenv("MT5_ACCOUNT_PASSWORD", "")
MT5_SERVER   = os.getenv("MT5_ACCOUNT_SERVER", "")

_ADMIN_MT5_ENABLED = bool(MT5_LOGIN and MT5_PASSWORD and MT5_SERVER and mt5)


def connect_mt5_admin() -> bool:
    if not _ADMIN_MT5_ENABLED:
        logger.info("ℹ️ MT5 not available — skipping admin connection")
        return False

    if not mt5.initialize():
        logger.error(f"❌ MT5 init failed: {mt5.last_error()}")
        return False

    if not mt5.login(login=MT5_LOGIN, password=MT5_PASSWORD, server=MT5_SERVER):
        logger.error(f"❌ MT5 login failed: {mt5.last_error()}")
        mt5.shutdown()
        return False

    logger.info("✅ MT5 connected")
    return True


def auto_reconnect_mt5():
    if not _ADMIN_MT5_ENABLED:
        return

    while True:
        try:
            if mt5.account_info() is None:
                logger.warning("⚠ MT5 disconnected — reconnecting...")
                mt5.shutdown()
                connect_mt5_admin()
            time.sleep(30)
        except Exception as e:
            logger.error(f"MT5 reconnect error: {e}")
            time.sleep(30)


async def journal_auto_sync():
    while True:
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, sync_mt5_trades)
            logger.info("📔 Journal Sync Complete")
        except Exception as e:
            logger.error(f"Journal sync error: {e}")
        await asyncio.sleep(60)


# ================= LIFESPAN =================

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting backend...")

    await init_db()
    logger.info("✅ DB ready")

    try:
        create_stripe_products()
    except Exception as e:
        logger.warning(f"Stripe skipped: {e}")

    if connect_mt5_admin():
        threading.Thread(target=auto_reconnect_mt5, daemon=True).start()
        asyncio.create_task(journal_auto_sync())

    await start_auto_lock_watcher()
    asyncio.create_task(start_trial_scheduler())

    if os.getenv("WEEKLY_REPORT_ENABLED", "true").lower() != "false":
        try:
            start_weekly_report_scheduler(SessionLocal)
        except Exception as e:
            logger.warning(f"Weekly report skipped: {e}")

    yield

    logger.info("🛑 Shutdown")
    if mt5:
        mt5.shutdown()


# ================= APP =================

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ================= CORS =================

origins = os.getenv("ALLOWED_ORIGINS", "").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ================= ROUTES =================

app.include_router(auth_router, prefix="/api/v1/auth")
app.include_router(accounts_router, prefix="/api/v1/accounts")
app.include_router(risk_router, prefix="/api/v1/risk")
app.include_router(positions_router, prefix="/api/v1/positions")
app.include_router(trades_router, prefix="/api/v1/trades")
app.include_router(rules_router, prefix="/api/v1/rules")
app.include_router(alerts_router, prefix="/api/v1/alerts")
app.include_router(analytics_router, prefix="/api/v1/analytics")
app.include_router(journal_router, prefix="/api/v1/journal")
app.include_router(ws_router)
app.include_router(setup_router, prefix="/api/v1/setup")
app.include_router(settings_router, prefix="/api/v1/settings")
app.include_router(trading_router, prefix="/api/v1/trading")
app.include_router(reports_router, prefix="/api/v1/reports")
app.include_router(alerts_live_router, prefix="/api/v1/alerts-live")
app.include_router(platforms_router, prefix="/api/v1/platforms")
app.include_router(accounts_multi_router, prefix="/api/v1/accounts-multi")

app.include_router(news_calendar_router, prefix="/api/v1/news")
app.include_router(weekly_report_router, prefix="/api/v1/report")
app.include_router(portfolio_router, prefix="/api/v1/portfolio")


# ================= HEALTH =================

@app.get("/")
async def root():
    return {"status": "running"}


# ================= RUN =================

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)




