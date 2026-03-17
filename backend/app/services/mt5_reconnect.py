"""
Automatic MT5 Reconnect Service
"""

from app.services.mt5_wrapper import get_mt5`nmt5 = get_mt5()
import time
import logging

logger = logging.getLogger(__name__)


def auto_reconnect():

    while True:

        try:

            info = mt5.account_info()

            if info is None:

                logger.warning("⚠ MT5 disconnected — reconnecting...")

                mt5.shutdown()

                connected = mt5.initialize()

                if connected:

                    logger.info("✅ MT5 reconnected successfully")

                else:

                    logger.error("❌ MT5 reconnect failed")

            time.sleep(10)

        except Exception as e:

            logger.error(f"Reconnect error: {e}")

            time.sleep(10)
