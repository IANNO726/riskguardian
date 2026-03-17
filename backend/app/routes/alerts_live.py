from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from datetime import datetime
from app.services.mt5_wrapper import get_mt5`nmt5 = get_mt5()
import asyncio
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Store last known state to detect changes
last_positions_count = 0
last_balance = 0
last_daily_pnl = 0

@router.get("/recent")
async def get_recent_alerts():
    """Get recent trading alerts based on MT5 activity"""
    
    alerts = []
    
    # Check MT5 connection
    if not mt5.initialize():
        alerts.append({
            "id": 1,
            "type": "error",
            "message": "MT5 Disconnected - Please check connection",
            "time": datetime.now().isoformat()
        })
        return {"alerts": alerts}
    
    account_info = mt5.account_info()
    if not account_info:
        return {"alerts": alerts}
    
    # Get current positions
    positions = mt5.positions_get()
    if positions is None:
        positions = []
    
    # Get recent closed trades (last 10)
    date_to = datetime.now()
    deals = mt5.history_deals_get(date_to.replace(hour=0, minute=0, second=0), date_to)
    
    if deals:
        # Get last 5 closed trades
        recent_deals = sorted(deals, key=lambda x: x.time, reverse=True)[:5]
        
        for idx, deal in enumerate(recent_deals):
            if deal.entry == 1:  # Closing trade
                alert_type = "success" if deal.profit > 0 else "error"
                alerts.append({
                    "id": 1000 + idx,
                    "type": alert_type,
                    "message": f"Position closed: {deal.symbol} {deal.profit:+.2f} USD",
                    "time": datetime.fromtimestamp(deal.time).isoformat()
                })
    
    # Alert for current open positions
    for idx, pos in enumerate(positions[:3]):  # Show last 3 positions
        action = "BUY" if pos.type == 0 else "SELL"
        alerts.append({
            "id": 2000 + idx,
            "type": "info",
            "message": f"Position open: {pos.symbol} {action} {pos.volume} lot, P&L: {pos.profit:+.2f}",
            "time": datetime.fromtimestamp(pos.time).isoformat()
        })
    
    # Check daily P&L
    daily_pnl = account_info.profit
    if daily_pnl < -50:
        alerts.append({
            "id": 3001,
            "type": "warning",
            "message": f"Daily loss alert: {daily_pnl:.2f} USD",
            "time": datetime.now().isoformat()
        })
    elif daily_pnl > 50:
        alerts.append({
            "id": 3002,
            "type": "success",
            "message": f"Daily profit: +{daily_pnl:.2f} USD",
            "time": datetime.now().isoformat()
        })
    
    # MT5 Connected alert
    alerts.append({
        "id": 4001,
        "type": "info",
        "message": f"MT5 Connected - Account {account_info.login}",
        "time": datetime.now().isoformat()
    })
    
    # Sort by time (most recent first)
    alerts.sort(key=lambda x: x['time'], reverse=True)
    
    return {"alerts": alerts[:10]}  # Return last 10 alerts
