from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import logging
from app.services.mt5_client import mt5_client

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/live-trades")
async def websocket_live_trades(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connected")
    
    try:
        if not mt5_client.is_connected():
            if not mt5_client.connect():
                await websocket.send_json({
                    "type": "error",
                    "message": "MT5 connection failed"
                })
                return
        
        while True:
            balance_data = mt5_client.get_balance()
            positions = mt5_client.get_positions() or []
            
            formatted_positions = []
            for pos in positions:
                formatted_positions.append({
                    "ticket": str(pos.get("ticket", "")),
                    "symbol": pos.get("symbol", ""),
                    "type": "BUY" if pos.get("type", 0) == 0 else "SELL",
                    "volume": pos.get("volume", 0),
                    "price_open": pos.get("price_open", 0),
                    "price_current": pos.get("price_current", 0),
                    "profit": round(pos.get("profit", 0), 2),
                })
            
            daily_pnl = balance_data.get("profit", 0) if balance_data else 0
            balance_val = balance_data.get("balance", 0) if balance_data else 0
            daily_pnl_pct = 0.0
            if balance_val > 0:
                daily_pnl_pct = round((daily_pnl / balance_val) * 100, 2)
            
            await websocket.send_json({
                "type": "update",
                "balance": balance_val,
                "equity": balance_data.get("equity", 0) if balance_data else 0,
                "dailyPnl": daily_pnl,
                "dailyPnlPct": daily_pnl_pct,
                "activePositions": len(formatted_positions),
                "positions": formatted_positions
            })
            
            logger.info(f"Update: Balance={balance_val}, Positions={len(formatted_positions)}, P&L={daily_pnl_pct}%")
            await asyncio.sleep(2)
            
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")



