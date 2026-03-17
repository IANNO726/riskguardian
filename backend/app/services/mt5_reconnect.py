"""
Automatic MT5 Reconnect Service
"""

import MetaTrader5 as mt5
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