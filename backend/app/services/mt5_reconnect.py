"""
Automatic MT5 Reconnect Service — Cloud-Safe Version
======================================================
On Render (Linux), mt5 is None so this service exits immediately
without looping or crashing. Only runs on local Windows installs.
"""
from app.services.mt5_wrapper import get_mt5, is_available
mt5 = get_mt5()

import time
import logging

logger = logging.getLogger(__name__)


def auto_reconnect():
    """
    Polls MT5 every 10 seconds and reconnects if disconnected.
    Exits immediately and silently on cloud/Linux where MT5 is unavailable.
    """

    # ── Guard: MT5 not available (Render / Linux) ───────────────────────────
    if mt5 is None:
        logger.info("ℹ️  MT5 not available — auto_reconnect disabled (cloud environment)")
        return   # ← clean exit, no loop, no crash

    logger.info("🔄 MT5 auto-reconnect service started")

    while True:
        try:
            info = mt5.account_info()

            if info is None:
                logger.warning("⚠️  MT5 disconnected — attempting reconnect...")
                try:
                    mt5.shutdown()
                except Exception:
                    pass

                connected = mt5.initialize()
                if connected:
                    logger.info("✅ MT5 reconnected successfully")
                else:
                    logger.error("❌ MT5 reconnect failed — will retry in 10s")

            time.sleep(10)

        except Exception as e:
            logger.error(f"Reconnect loop error: {e}")
            time.sleep(10)



