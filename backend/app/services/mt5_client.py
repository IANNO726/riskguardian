import MetaTrader5 as mt5
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


class MT5Client:
    def __init__(self):
        self.connected = False
        self.account_info = None
        
    def connect(self):
        """Connect to MT5 terminal"""
        try:
            # Initialize MT5
            if not mt5.initialize():
                logger.error(f"MT5 initialize() failed, error code: {mt5.last_error()}")
                return False
            
            # Login to account
            authorized = mt5.login(
                login=int(settings.MT5_ACCOUNT_LOGIN),
                password=settings.MT5_ACCOUNT_PASSWORD,
                server=settings.MT5_ACCOUNT_SERVER
            )
            
            if not authorized:
                logger.error(f"MT5 login failed, error code: {mt5.last_error()}")
                mt5.shutdown()
                return False
            
            # Get account info
            account_info = mt5.account_info()
            if account_info is None:
                logger.error("Failed to get account info")
                return False
            
            self.account_info = account_info._asdict()
            self.connected = True
            
            logger.info(f"✅ Connected to MT5")
            logger.info(f"📧 Account: {self.account_info['login']}")
            logger.info(f"💰 Balance: {self.account_info['balance']} {self.account_info['currency']}")
            logger.info(f"📊 Equity: {self.account_info['equity']} {self.account_info['currency']}")
            
            return True
            
        except Exception as e:
            logger.error(f"MT5 connection error: {e}")
            return False
    
    def is_connected(self):
        """Check if connected to MT5"""
        return self.connected and mt5.terminal_info() is not None
    
    def get_balance(self):
        """Get current account balance"""
        if not self.is_connected():
            return None
        
        account_info = mt5.account_info()
        if account_info is None:
            return None
        
        return {
            "balance": account_info.balance,
            "equity": account_info.equity,
            "profit": account_info.profit,
            "margin": account_info.margin,
            "margin_free": account_info.margin_free,
            "currency": account_info.currency
        }
    
    def get_positions(self):
        """Get all open positions"""
        if not self.is_connected():
            return []
        
        positions = mt5.positions_get()
        if positions is None:
            return []
        
        return [pos._asdict() for pos in positions]
    
    def get_history(self, days=7):
        """Get trade history"""
        if not self.is_connected():
            return []
        
        from datetime import datetime, timedelta
        
        date_from = datetime.now() - timedelta(days=days)
        date_to = datetime.now()
        
        deals = mt5.history_deals_get(date_from, date_to)
        if deals is None:
            return []
        
        return [deal._asdict() for deal in deals]
    
    def disconnect(self):
        """Disconnect from MT5"""
        if self.connected:
            mt5.shutdown()
            self.connected = False
            logger.info("🔌 Disconnected from MT5")


# Singleton instance
mt5_client = MT5Client()


# Test function
def test_connection():
    """Test MT5 connection"""
    print("\n" + "="*60)
    print("Testing MT5 Connection")
    print("="*60 + "\n")
    
    success = mt5_client.connect()
    
    if success:
        print("\n✅ Connection successful!")
        print(f"Connected: {mt5_client.is_connected()}")
        
        balance = mt5_client.get_balance()
        if balance:
            print(f"\n💰 Account Balance:")
            print(f"   Balance: {balance['balance']} {balance['currency']}")
            print(f"   Equity: {balance['equity']} {balance['currency']}")
            print(f"   Profit: {balance['profit']} {balance['currency']}")
        
        positions = mt5_client.get_positions()
        print(f"\n📊 Open Positions: {len(positions)}")
        
    else:
        print("\n❌ Connection failed")
        print("💡 Make sure MT5 terminal is running and credentials are correct")
    
    print("\n" + "="*60 + "\n")
    
    mt5_client.disconnect()


if __name__ == "__main__":
    test_connection()