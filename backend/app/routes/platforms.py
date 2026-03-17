"""
Platform Testing Routes
Test MT5, MT4, and cTrader connections
"""
from fastapi import APIRouter, HTTPException
from typing import Dict
import logging

from app.platforms.mt5_adapter import MT5Adapter
from app.platforms.mt4_adapter import MT4Adapter
from app.platforms.ctrader_adapter import CTraderAdapter

router = APIRouter(tags=["Platforms"])
logger = logging.getLogger(__name__)


@router.get("/test/mt5")
async def test_mt5_connection():
    """Test MT5 connection with current session"""
    try:
        # Use empty credentials to test with current MT5 session
        adapter = MT5Adapter({})
        
        connected = await adapter.connect()
        
        if not connected:
            return {
                "platform": "MT5",
                "status": "disconnected",
                "message": "MT5 not connected. Please open MT5 and login first."
            }
        
        # Get account info
        account_info = await adapter.get_account_info()
        
        # Get positions
        positions = await adapter.get_open_positions()
        
        # Get symbols count
        symbols = await adapter.get_symbols()
        
        await adapter.disconnect()
        
        return {
            "platform": "MT5",
            "status": "connected",
            "account_info": account_info,
            "open_positions_count": len(positions),
            "available_symbols_count": len(symbols),
            "sample_positions": positions[:3] if positions else [],
            "message": "✅ MT5 connection successful!"
        }
        
    except Exception as e:
        logger.error(f"MT5 test failed: {e}")
        return {
            "platform": "MT5",
            "status": "error",
            "error": str(e)
        }


@router.post("/test/mt5/login")
async def test_mt5_login(credentials: Dict):
    """
    Test MT5 connection with specific credentials
    Body: {"login": "123456", "password": "your_password", "server": "Deriv-Demo"}
    """
    try:
        adapter = MT5Adapter(credentials)
        
        connected = await adapter.connect()
        
        if not connected:
            raise HTTPException(status_code=400, detail="Failed to connect to MT5")
        
        account_info = await adapter.get_account_info()
        positions = await adapter.get_open_positions()
        
        await adapter.disconnect()
        
        return {
            "platform": "MT5",
            "status": "connected",
            "account": account_info.get("login"),
            "server": account_info.get("server"),
            "balance": account_info.get("balance"),
            "equity": account_info.get("equity"),
            "open_positions": len(positions),
            "message": "✅ MT5 login successful!"
        }
        
    except Exception as e:
        logger.error(f"MT5 login test failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/test/mt4")
async def test_mt4_connection():
    """Test MT4 connection (placeholder)"""
    adapter = MT4Adapter({})
    connected = await adapter.connect()
    
    return {
        "platform": "MT4",
        "status": "not_implemented",
        "message": "MT4 support coming soon - requires ZeroMQ or REST bridge",
        "connected": connected
    }


@router.get("/test/ctrader")
async def test_ctrader_connection():
    """Test cTrader connection (placeholder)"""
    adapter = CTraderAdapter({})
    connected = await adapter.connect()
    
    return {
        "platform": "cTrader",
        "status": "not_implemented",
        "message": "cTrader support coming soon - requires Spotware API credentials",
        "connected": connected
    }


@router.get("/supported")
async def get_supported_platforms():
    """Get list of supported platforms"""
    return {
        "platforms": [
            {
                "name": "MetaTrader 5",
                "code": "MT5",
                "status": "fully_supported",
                "features": ["live_data", "positions", "history", "close_trades", "symbols"]
            },
            {
                "name": "MetaTrader 4",
                "code": "MT4",
                "status": "coming_soon",
                "features": [],
                "required": "ZeroMQ or REST API bridge"
            },
            {
                "name": "cTrader",
                "code": "cTrader",
                "status": "coming_soon",
                "features": [],
                "required": "Spotware Open API credentials"
            }
        ]
    }