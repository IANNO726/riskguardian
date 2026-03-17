"""
Trades Routes
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from app.services.mt5_wrapper import get_mt5`nmt5 = get_mt5()
import logging

from app.database.database import get_db

router = APIRouter(tags=["Trades"])
logger = logging.getLogger(__name__)


@router.get("/")
async def get_trades(
    account_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db)
):
    """Get trade history from MT5"""
    utc_to = datetime.now()
    utc_from = datetime(2020, 1, 1)

    deals = mt5.history_deals_get(utc_from, utc_to)

    if deals is None:
        return {
            "trades": [],
            "total": 0,
            "total_profit": 0,
            "error": str(mt5.last_error())
        }

    trades = []
    total_profit = 0

    for deal in deals:
        # Only Buy/Sell trades
        if deal.type > 1:
            continue

        # Skip deposits/withdrawals
        if abs(deal.profit) > 1000:
            continue

        total_profit += deal.profit

        trades.append({
            "id": deal.ticket,
            "ticket": str(deal.ticket),
            "symbol": deal.symbol,
            "type": "BUY" if deal.type == 0 else "SELL",
            "volume": deal.volume,
            "open_price": deal.price,
            "close_price": deal.price,
            "open_time": datetime.fromtimestamp(deal.time).isoformat(),
            "close_time": datetime.fromtimestamp(deal.time).isoformat(),
            "profit": deal.profit,
            "commission": deal.commission,
            "swap": deal.swap,
            "status": "closed"
        })

    logger.info(f"Loaded {len(trades)} MT5 trades")

    return {
        "trades": trades[:limit],
        "total": len(trades),
        "total_profit": total_profit
    }


@router.get("/history")
async def get_trade_history():
    """Get closed trades from MT5 for History page"""
    try:
        if not mt5.initialize():
            logger.error("MT5 not initialized")
            return {"trades": [], "error": "MT5 not initialized"}

        # Get last 90 days of history
        date_to = datetime.now()
        date_from = date_to - timedelta(days=90)

        logger.info(f"Fetching history from {date_from} to {date_to}")

        deals = mt5.history_deals_get(date_from, date_to)

        if deals is None:
            logger.error(f"Failed to get history: {mt5.last_error()}")
            return {"trades": [], "error": str(mt5.last_error())}

        if len(deals) == 0:
            logger.info("No deals found in history")
            return {"trades": []}

        logger.info(f"Found {len(deals)} total deals")

        trades = []
        for deal in deals:
            # Only include closing deals (entry=1)
            if deal.entry == 1:
                # Skip balance operations
                if deal.type > 1:
                    continue
                
                # Skip deposits/withdrawals
                if abs(deal.profit) > 10000:
                    continue

                trades.append({
                    "ticket": deal.ticket,
                    "time": datetime.fromtimestamp(deal.time).isoformat(),
                    "symbol": deal.symbol,
                    "type": "Buy" if deal.type == 0 else "Sell",
                    "volume": deal.volume,
                    "price": deal.price,
                    "profit": deal.profit,
                    "comment": deal.comment or ""
                })

        # Sort by time descending (newest first)
        trades.sort(key=lambda x: x['time'], reverse=True)

        logger.info(f"Returning {len(trades)} closed trades")

        return {"trades": trades}

    except Exception as e:
        logger.error(f"History fetch error: {e}")
        return {"trades": [], "error": str(e)}


@router.get("/{trade_id}")
async def get_trade(trade_id: int, db: Session = Depends(get_db)):
    """Get specific trade details"""
    return {
        "id": trade_id,
        "ticket": str(trade_id),
        "symbol": "MT5",
        "type": "BUY",
        "volume": 0.1,
        "open_price": 0,
        "close_price": 0,
        "profit": 0,
        "risk_reward_ratio": 0
    }


@router.get("/stats/summary")
async def get_trade_stats(
    account_id: Optional[int] = None,
    period: str = "today",
    db: Session = Depends(get_db)
):
    """Get trading statistics summary"""
    utc_to = datetime.now()
    utc_from = datetime(2020, 1, 1)

    deals = mt5.history_deals_get(utc_from, utc_to)

    if deals is None:
        return {
            "total_trades": 0,
            "winning_trades": 0,
            "losing_trades": 0,
            "win_rate": 0,
            "net_profit": 0
        }

    profits = []
    for deal in deals:
        if deal.type > 1:
            continue

        if abs(deal.profit) > 1000:
            continue

        profits.append(deal.profit)

    total_trades = len(profits)
    wins = [p for p in profits if p > 0]
    losses = [p for p in profits if p < 0]

    total_profit = sum(wins)
    total_loss = sum(losses)

    win_rate = (len(wins) / total_trades * 100) if total_trades else 0

    return {
        "total_trades": total_trades,
        "winning_trades": len(wins),
        "losing_trades": len(losses),
        "win_rate": win_rate,
        "total_profit": total_profit,
        "total_loss": total_loss,
        "net_profit": total_profit + total_loss,
        "average_win": total_profit / len(wins) if wins else 0,
        "average_loss": total_loss / len(losses) if losses else 0,
        "profit_factor": abs(total_profit / total_loss) if total_loss else 0,
        "largest_win": max(wins) if wins else 0,
        "largest_loss": min(losses) if losses else 0
    }
