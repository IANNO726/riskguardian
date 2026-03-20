from fastapi import APIRouter
from datetime import datetime
from app.services.mt5_wrapper import get_mt5
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

mt5 = get_mt5()


@router.get("/recent")
async def get_recent_alerts():
    """Get recent trading alerts based on MT5 activity"""

    alerts = []

    # ── Guard: MT5 not available on Render ────────────────────
    if mt5 is None:
        alerts.append({
            "id": 1,
            "type": "info",
            "message": "🌐 Running on cloud — connect MT5 locally for live alerts",
            "time": datetime.now().isoformat(),
        })
        return {"alerts": alerts, "connected": False}

    # ── MT5 available — check connection ──────────────────────
    if not mt5.initialize():
        alerts.append({
            "id": 1,
            "type": "error",
            "message": "MT5 Disconnected — please check connection",
            "time": datetime.now().isoformat(),
        })
        return {"alerts": alerts, "connected": False}

    account_info = mt5.account_info()
    if not account_info:
        return {"alerts": alerts, "connected": False}

    # ── Recent closed trades ───────────────────────────────────
    date_to   = datetime.now()
    date_from = date_to.replace(hour=0, minute=0, second=0)
    deals = mt5.history_deals_get(date_from, date_to)

    if deals:
        recent_deals = sorted(deals, key=lambda x: x.time, reverse=True)[:5]
        for idx, deal in enumerate(recent_deals):
            if deal.entry == 1:  # Closing trade
                alert_type = "success" if deal.profit > 0 else "error"
                alerts.append({
                    "id": 1000 + idx,
                    "type": alert_type,
                    "message": f"Position closed: {deal.symbol} {deal.profit:+.2f} USD",
                    "time": datetime.fromtimestamp(deal.time).isoformat(),
                })

    # ── Open positions ─────────────────────────────────────────
    positions = mt5.positions_get() or []
    for idx, pos in enumerate(positions[:3]):
        action = "BUY" if pos.type == 0 else "SELL"
        alerts.append({
            "id": 2000 + idx,
            "type": "info",
            "message": f"Position open: {pos.symbol} {action} {pos.volume} lot, P&L: {pos.profit:+.2f}",
            "time": datetime.fromtimestamp(pos.time).isoformat(),
        })

    # ── Daily P&L alerts ───────────────────────────────────────
    daily_pnl = account_info.profit
    if daily_pnl < -50:
        alerts.append({
            "id": 3001,
            "type": "warning",
            "message": f"Daily loss alert: {daily_pnl:.2f} USD",
            "time": datetime.now().isoformat(),
        })
    elif daily_pnl > 50:
        alerts.append({
            "id": 3002,
            "type": "success",
            "message": f"Daily profit: +{daily_pnl:.2f} USD",
            "time": datetime.now().isoformat(),
        })

    # ── Connection status ──────────────────────────────────────
    alerts.append({
        "id": 4001,
        "type": "info",
        "message": f"MT5 Connected — Account {account_info.login}",
        "time": datetime.now().isoformat(),
    })

    alerts.sort(key=lambda x: x["time"], reverse=True)
    return {"alerts": alerts[:10], "connected": True}



