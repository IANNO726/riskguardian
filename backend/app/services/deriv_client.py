"""
Deriv API Client Service
"""
import asyncio
from deriv_api import DerivAPI
import logging
import os
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Configuration
APP_ID = int(os.getenv('DERIV_APP_ID', 1089))
DERIV_TOKEN = os.getenv('DERIV_TOKEN', '')


class DerivClient:
    def __init__(self):
        self.api = None
        self._connected = False
        self._authenticated = False
        self.account_info = None
        
    async def connect(self):
        """Connect and authenticate with Deriv API"""
        try:
            if self.api is None:
                logger.info("🔄 Connecting to Deriv...")
                self.api = DerivAPI(app_id=APP_ID)
                
                # Test connection with ping
                await self.api.ping()
                self._connected = True
                logger.info("✅ Connected to Deriv (ping successful)")
                
                # Authenticate if token is provided
                if DERIV_TOKEN:
                    try:
                        auth_response = await self.api.authorize(DERIV_TOKEN)
                        self._authenticated = True
                        self.account_info = auth_response.get('authorize', {})
                        
                        logger.info(f"✅ Authenticated with Deriv")
                        logger.info(f"📧 Email: {self.account_info.get('email', 'N/A')}")
                        logger.info(f"💰 Balance: {self.account_info.get('balance', 0)} {self.account_info.get('currency', 'USD')}")
                        logger.info(f"🆔 Login ID: {self.account_info.get('loginid', 'N/A')}")
                        
                        return True
                    except Exception as auth_error:
                        logger.error(f"❌ Authentication failed: {auth_error}")
                        logger.error(f"💡 Token (first 10 chars): {DERIV_TOKEN[:10]}...")
                        logger.error(f"💡 Please verify your DERIV_TOKEN in .env file")
                        logger.error(f"💡 Get a token from: https://app.deriv.com/account/api-token")
                        self._authenticated = False
                        return False
                else:
                    logger.warning("⚠️ No DERIV_TOKEN provided - running without authentication")
                    logger.warning("💡 Add DERIV_TOKEN to .env file for full functionality")
                    return True
                    
        except Exception as e:
            logger.error(f"❌ Deriv connection failed: {e}")
            self.api = None
            self._connected = False
            self._authenticated = False
            return False
    
    def is_connected(self):
        """Check if connected to Deriv"""
        return self._connected and self.api is not None
    
    def is_authenticated(self):
        """Check if authenticated with Deriv"""
        return self._authenticated
    
    async def get_balance(self):
        """Get current account balance"""
        if not self.api:
            await self.connect()
        
        if not self._authenticated:
            raise Exception("Not authenticated. Please provide DERIV_TOKEN in .env file")
        
        try:
            balance_response = await self.api.balance()
            return balance_response
        except Exception as e:
            logger.error(f"❌ Failed to get balance: {e}")
            raise
    
    async def subscribe_balance(self, callback):
        """Subscribe to balance updates"""
        if not self.api:
            await self.connect()
        
        if not self._authenticated:
            raise Exception("Not authenticated. Please provide DERIV_TOKEN in .env file")
        
        try:
            observable = await self.api.subscribe({"balance": 1})
            observable.subscribe(
                on_next=callback,
                on_error=lambda err: logger.error(f"Balance stream error: {err}"),
                on_completed=lambda: logger.info("Balance stream completed")
            )
            return observable
        except Exception as e:
            logger.error(f"❌ Failed to subscribe to balance: {e}")
            raise
    
    async def get_account_info(self):
        """Get account information"""
        if self.account_info:
            return self.account_info
        
        if not self._authenticated:
            raise Exception("Not authenticated")
        
        return self.account_info
    
    async def disconnect(self):
        """Disconnect from Deriv API"""
        if self.api:
            # Deriv API doesn't have explicit disconnect, just clear reference
            self.api = None
            self._connected = False
            self._authenticated = False
            self.account_info = None
            logger.info("🔌 Disconnected from Deriv")
    
    async def reconnect(self):
        """Reconnect to Deriv"""
        await self.disconnect()
        return await self.connect()


# Singleton instance
deriv_client = DerivClient()


# Test function (for debugging)
async def test_connection():
    """Test Deriv connection"""
    print("\n" + "="*50)
    print("Testing Deriv Connection")
    print("="*50 + "\n")
    
    success = await deriv_client.connect()
    
    if success and deriv_client.is_authenticated():
        print("\n✅ All tests passed!")
        print(f"Connected: {deriv_client.is_connected()}")
        print(f"Authenticated: {deriv_client.is_authenticated()}")
        
        try:
            balance = await deriv_client.get_balance()
            print(f"\n💰 Current Balance:")
            print(f"   Balance: {balance['balance']['balance']}")
            print(f"   Currency: {balance['balance']['currency']}")
        except Exception as e:
            print(f"\n❌ Failed to get balance: {e}")
    else:
        print("\n❌ Connection or authentication failed")
        print("💡 Check your .env file and DERIV_TOKEN")
    
    print("\n" + "="*50 + "\n")


if __name__ == "__main__":
    # Run test when file is executed directly
    asyncio.run(test_connection())



