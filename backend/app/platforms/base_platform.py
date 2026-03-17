"""
Base Platform Interface
All trading platforms must implement this interface
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from datetime import datetime

class BasePlatform(ABC):
    """Abstract base class for all trading platforms"""
    
    def __init__(self, credentials: Dict):
        self.credentials = credentials
        self.connected = False
    
    @abstractmethod
    async def connect(self) -> bool:
        """Connect to the trading platform"""
        pass
    
    @abstractmethod
    async def disconnect(self) -> bool:
        """Disconnect from the trading platform"""
        pass
    
    @abstractmethod
    async def get_account_info(self) -> Dict:
        """Get account balance, equity, margin, etc."""
        pass
    
    @abstractmethod
    async def get_open_positions(self) -> List[Dict]:
        """Get all open positions"""
        pass
    
    @abstractmethod
    async def get_trade_history(self, days: int = 90) -> List[Dict]:
        """Get closed trades history"""
        pass
    
    @abstractmethod
    async def close_position(self, ticket: int) -> bool:
        """Close a specific position"""
        pass
    
    @abstractmethod
    async def get_symbols(self) -> List[str]:
        """Get available trading symbols"""
        pass
    
    def is_connected(self) -> bool:
        """Check if platform is connected"""
        return self.connected
