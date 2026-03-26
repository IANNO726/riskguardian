"""
MT5 Client — Cloud-Safe Version
================================
On Render (Linux), mt5 is None so all methods gracefully return
empty/False values without crashing. Only runs real MT5 logic
when running locally on Windows with MT5 installed.
"""
from app.services.mt5_wrapper import get_mt5, is_available
mt5 = get_mt5()

import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


class MT5Client:
    def __init__(self):
        self.connected   = False
        self.account_info = None

    def connect(self) -> bool:
        """Connect to MT5 terminal. Silent no-op on cloud/Linux."""

        # ── Guard: MT5 not available (Render / Linux) ──────────────────────
        if mt5 is None:
            logger.info("ℹ️  MT5 not available in this environment — skipping connect")
            return False

        try:
            if not mt5.initialize():
                logger.error(f"MT5 initialize() failed: {mt5.last_error()}")
                return False

            authorized = mt5.login(
                login=int(settings.MT5_ACCOUNT_LOGIN),
                password=settings.MT5_ACCOUNT_PASSWORD,
                server=settings.MT5_ACCOUNT_SERVER,
            )
            if not authorized:
                logger.error(f"MT5 login failed: {mt5.last_error()}")
                mt5.shutdown()
                return False

            account_info = mt5.account_info()
            if account_info is None:
                logger.error("Failed to get MT5 account info")
                return False

            self.account_info = account_info._asdict()
            self.connected    = True

            logger.info("✅ Connected to MT5")
            logger.info(f"📧 Account : {self.account_info['login']}")
            logger.info(f"💰 Balance : {self.account_info['balance']} {self.account_info['currency']}")
            logger.info(f"📊 Equity  : {self.account_info['equity']}  {self.account_info['currency']}")
            return True

        except Exception as e:
            logger.error(f"MT5 connection error: {e}")
            return False

    def is_connected(self) -> bool:
        """Check if connected to MT5. Always False on cloud."""
        if mt5 is None:
            return False
        try:
            return self.connected and mt5.terminal_info() is not None
        except Exception:
            return False

    def get_balance(self) -> dict | None:
        """Get current account balance. Returns None on cloud."""
        if mt5 is None or not self.is_connected():
            return None
        try:
            info = mt5.account_info()
            if info is None:
                return None
            return {
                "balance":     info.balance,
                "equity":      info.equity,
                "profit":      info.profit,
                "margin":      info.margin,
                "margin_free": info.margin_free,
                "currency":    info.currency,
            }
        except Exception as e:
            logger.error(f"get_balance error: {e}")
            return None

    def get_positions(self) -> list:
        """Get open positions. Returns [] on cloud."""
        if mt5 is None or not self.is_connected():
            return []
        try:
            positions = mt5.positions_get()
            return [p._asdict() for p in positions] if positions else []
        except Exception as e:
            logger.error(f"get_positions error: {e}")
            return []

    def get_history(self, days: int = 7) -> list:
        """Get trade history. Returns [] on cloud."""
        if mt5 is None or not self.is_connected():
            return []
        try:
            from datetime import datetime, timedelta
            date_from = datetime.now() - timedelta(days=days)
            deals     = mt5.history_deals_get(date_from, datetime.now())
            return [d._asdict() for d in deals] if deals else []
        except Exception as e:
            logger.error(f"get_history error: {e}")
            return []

    def disconnect(self):
        """Disconnect from MT5. Silent no-op on cloud."""
        if mt5 is None:
            return
        if self.connected:
            try:
                mt5.shutdown()
            except Exception:
                pass
            self.connected = False
            logger.info("🔌 Disconnected from MT5")


# ── Singleton ──────────────────────────────────────────────────────────────
mt5_client = MT5Client()


# ── Test helper (local use only) ───────────────────────────────────────────
def test_connection():
    print("\n" + "=" * 60)
    print("Testing MT5 Connection")
    print("=" * 60 + "\n")

    if not is_available():
        print("⚠️  MT5 is not available in this environment (Linux/cloud).")
        print("   This is expected on Render. Run locally on Windows to test.")
        print("\n" + "=" * 60 + "\n")
        return

    success = mt5_client.connect()

    if success:
        print("\n✅ Connection successful!")
        balance = mt5_client.get_balance()
        if balance:
            print(f"\n💰 Balance : {balance['balance']} {balance['currency']}")
            print(f"📊 Equity  : {balance['equity']}  {balance['currency']}")
            print(f"📈 Profit  : {balance['profit']}  {balance['currency']}")
        positions = mt5_client.get_positions()
        print(f"\n📊 Open Positions: {len(positions)}")
    else:
        print("\n❌ Connection failed")
        print("💡 Make sure MT5 terminal is running and credentials are correct")

    print("\n" + "=" * 60 + "\n")
    mt5_client.disconnect()


if __name__ == "__main__":
    test_connection()



