"""
MetaTrader 4 Platform Adapter
Note: MT4 requires a bridge (ZeroMQ or REST API) - placeholder for now
"""
from typing import List, Dict
import logging
from .base_platform import BasePlatform

logger = logging.getLogger(__name__)

class MT4Adapter(BasePlatform):
    """MetaTrader 4 platform implementation (placeholder)"""
    
    def __init__(self, credentials: Dict):
        super().__init__(credentials)
        self.platform_name = "MetaTrader 4"
    
    async def connect(self) -> bool:
        """Connect to MT4 via ZMQ/REST bridge"""
        logger.warning("⚠️ MT4 support coming soon - requires bridge installation")
        # TODO: Implement MT4 connection via DWX-ZeroMQ or REST API
        return False
    
    async def disconnect(self) -> bool:
        """Disconnect from MT4"""
        self.connected = False
        return True
    
    async def get_account_info(self) -> Dict:
        """Get MT4 account information"""
        return {
            "platform": "MT4",
            "message": "MT4 integration coming soon - requires bridge setup"
        }
    
    async def get_open_positions(self) -> List[Dict]:
        """Get MT4 open positions"""
        return []
    
    async def get_trade_history(self, days: int = 90) -> List[Dict]:
        """Get MT4 trade history"""
        return []
    
    async def close_position(self, ticket: int) -> bool:
        """Close MT4 position"""
        return False
    
    async def get_symbols(self) -> List[str]:
        """Get available symbols"""
        return []
