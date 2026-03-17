"""
main.py — FastAPI Application Entry Point

KEY CHANGE:
  The global MT5 connection at startup now only serves internal/admin
  features (journal sync, etc). User-facing MT5 data goes through
  accounts_multi.py → MT5Adapter, which connects with each user's
  own credentials from the trading_accounts table.
"""
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
import MetaTrader5 as mt5
import asyncio
import os
import threading
import time

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
from app.routes.risk_engine import router as risk_engine_router          # ✅ Phase 1
from app.routes.simulator import router as simulator_router              # ✅ Phase 2

# ── New routes (Phase 3 extensions + Phase 4 extension + Phase 1 extensions) ──
from app.routes.news_calendar import router as news_calendar_router      # ✅ News Calendar
from app.routes.weekly_report import router as weekly_report_router      # ✅ Weekly Report
from app.routes.portfolio_tracker import router as portfolio_router      # ✅ Portfolio + Margin

# Weekly report scheduler
from app.routes.weekly_report import start_scheduler as start_weekly_report_scheduler
from app.database.database import SessionLocal


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ======================================================
# ADMIN / INTERNAL MT5 — only used for journal sync etc.
# User-facing MT5 data uses each user's own credentials
# via MT5Adapter in accounts_multi.py
# ======================================================

MT5_LOGIN    = int(os.getenv("MT5_ACCOUNT_LOGIN",    "0"))
MT5_PASSWORD = os.getenv("MT5_ACCOUNT_PASSWORD", "")
MT5_SERVER   = os.getenv("MT5_ACCOUNT_SERVER",   "")

_ADMIN_MT5_ENABLED = bool(MT5_LOGIN and MT5_PASSWORD and MT5_SERVER)


def connect_mt5_admin() -> bool:
    """
    Connect the admin/internal MT5 session (from .env).
    Only used for background services — NOT for user live-data.
    Returns False gracefully if .env creds are not set.
    """
    if not _ADMIN_MT5_ENABLED:
        logger.info("ℹ️  No admin MT5 creds in .env — internal MT5 session skipped.")
        return False

    if not mt5.initialize():
        logger.error(f"❌ MT5 initialize() failed: {mt5.last_error()}")
        return False

    authorized = mt5.login(
        login=MT5_LOGIN,
        password=MT5_PASSWORD,
        server=MT5_SERVER,
    )
    if not authorized:
        logger.error(f"❌ MT5 admin login failed: {mt5.last_error()}")
        mt5.shutdown()
        return False

    logger.info("✅ Admin MT5 session ready (journal sync / background tasks)")
    return True


# ======================================================
# AUTO RECONNECT (admin session only)
# ======================================================

def auto_reconnect_mt5():
    """Keeps the admin MT5 session alive. Runs in a daemon thread."""
    if not _ADMIN_MT5_ENABLED:
        return
    while True:
        try:
            if mt5.account_info() is None:
                logger.warning("⚠ Admin MT5 disconnected — reconnecting...")
                mt5.shutdown()
                connect_mt5_admin()
            time.sleep(30)   # check every 30 s (not 10 — reduces noise)
        except Exception as e:
            logger.error(f"Admin MT5 reconnect error: {e}")
            time.sleep(30)


# ======================================================
# JOURNAL SYNC (uses admin MT5 session)
# ======================================================

async def journal_auto_sync():
    while True:
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, sync_mt5_trades)
            logger.info("📔 Journal MT5 Sync Complete")
        except Exception as e:
            logger.error(f"Journal sync error: {e}")
        await asyncio.sleep(60)


# ======================================================
# FASTAPI LIFESPAN
# ======================================================

@asynccontextmanager
async def lifespan(app: FastAPI):

    logger.info("🚀 Backend starting...")

    await init_db()
    logger.info("✅ Database ready")

    try:
        create_stripe_products()
        logger.info("✅ Stripe products ready")
    except Exception as e:
        logger.warning(f"⚠ Stripe setup skipped: {e}")

    # Admin MT5 session (not required for user connections)
    if connect_mt5_admin():
        threading.Thread(target=auto_reconnect_mt5, daemon=True).start()
        asyncio.create_task(journal_auto_sync())
    else:
        logger.info(
            "ℹ️  Admin MT5 not started — user accounts use their own MT5 "
            "credentials via /api/v1/accounts-multi/{id}/live-data"
        )

    await start_auto_lock_watcher()
    logger.info("✅ Auto-lock watcher ready")

    asyncio.create_task(start_trial_scheduler())
    logger.info("✅ Trial scheduler ready")

    # ── Weekly report scheduler ────────────────────────────────────────────────
    # Sends every Sunday at 8 PM via Telegram and/or Email.
    # Requires in .env:
    #   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID        ← for Telegram
    #   REPORT_EMAIL_TO, SMTP_USER, SMTP_PASSWORD   ← for Email (Gmail)
    # Set WEEKLY_REPORT_ENABLED=false to disable without removing the code.
    if os.getenv("WEEKLY_REPORT_ENABLED", "true").lower() != "false":
        try:
            start_weekly_report_scheduler(SessionLocal)
            logger.info("✅ Weekly report scheduler ready (Sunday 8 PM → Telegram + Email)")
        except Exception as e:
            logger.warning(f"⚠ Weekly report scheduler skipped: {e}")
    else:
        logger.info("ℹ️  Weekly report scheduler disabled (WEEKLY_REPORT_ENABLED=false)")

    yield

    logger.info("🛑 Backend shutdown")
    if _ADMIN_MT5_ENABLED:
        mt5.shutdown()


# ======================================================
# RATE LIMITER
# ======================================================

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ======================================================
# CORS
# ======================================================

_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001,http://192.168.43.131:3000"
)
CORS_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info(f"🔒 CORS origins: {CORS_ORIGINS}")


# ======================================================
# API ROUTES
# ======================================================

# ── Existing routes ────────────────────────────────────────────────────────────
app.include_router(auth_router,           prefix="/api/v1/auth")
app.include_router(accounts_router,       prefix="/api/v1/accounts")
app.include_router(risk_router,           prefix="/api/v1/risk")
app.include_router(positions_router,      prefix="/api/v1/positions")
app.include_router(trades_router,         prefix="/api/v1/trades")
app.include_router(rules_router,          prefix="/api/v1/rules")
app.include_router(alerts_router,         prefix="/api/v1/alerts")
app.include_router(analytics_router,      prefix="/api/v1/analytics")
app.include_router(journal_router,        prefix="/api/v1/journal")
app.include_router(ws_router)
app.include_router(setup_router,          prefix="/api/v1/setup")
app.include_router(settings_router,       prefix="/api/v1/settings")
app.include_router(trading_router,        prefix="/api/v1/trading")
app.include_router(reports_router,        prefix="/api/v1/reports")
app.include_router(alerts_live_router,    prefix="/api/v1/alerts-live")
app.include_router(platforms_router,      prefix="/api/v1/platforms",      tags=["Platforms"])
app.include_router(auth_multi_router,     prefix="/api/v1/auth-multi",     tags=["Multi-User Auth"])
app.include_router(accounts_multi_router, prefix="/api/v1/accounts-multi", tags=["Multi-Account"])
app.include_router(founder_router,        prefix="/api/v1/founder")
app.include_router(risk_status_router,    prefix="/api/v1/risk")
app.include_router(founder_users_router,  prefix="/api/v1/founder")
app.include_router(trial_router,          prefix="/api/v1/billing")
app.include_router(telegram_router,       prefix="/api/v1")
app.include_router(admin_router,          prefix="/api/v1/admin",          tags=["Admin Dashboard"])
app.include_router(admin_stream_router)
app.include_router(subscription_router,   prefix="/api/v1/subscriptions",  tags=["Subscriptions"])
app.include_router(billing_router,        prefix="/api/v1/billing",        tags=["Billing"])
app.include_router(cooldown_router,       prefix="/api/v1/cooldown",       tags=["Cooldown"])
app.include_router(prop_firms_router,     prefix="/api/v1/prop-firms",     tags=["Prop Firms"])
app.include_router(risk_rules_router,     prefix="/api/v1/risk-rules",     tags=["Risk Rules"])
app.include_router(white_label_router,    prefix="/api/v1/white-label",    tags=["White Label"])
app.include_router(api_webhooks_router,   prefix="/api/v1/api-access",     tags=["API Access"])
app.include_router(team_router,           prefix="/api/v1/team",           tags=["Team"])
app.include_router(integrations_router,   prefix="/api/v1/integrations",   tags=["Integrations"])
app.include_router(risk_engine_router,    prefix="/api/v1/risk-engine",    tags=["Risk Engine"])    # ✅ Phase 1
app.include_router(simulator_router,      prefix="/api/v1/simulator",      tags=["Simulator"])      # ✅ Phase 2

# ── New routes ─────────────────────────────────────────────────────────────────
app.include_router(news_calendar_router,  prefix="/api/v1/news",           tags=["News Calendar"])  # ✅ News
app.include_router(weekly_report_router,  prefix="/api/v1/report",         tags=["Weekly Report"])  # ✅ Report
app.include_router(portfolio_router,      prefix="/api/v1/portfolio",      tags=["Portfolio"])      # ✅ Portfolio


# ======================================================
# HEALTH
# ======================================================

@app.get("/")
async def root():
    return {"status": "running"}


# ======================================================
# RUN
# ======================================================

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)



