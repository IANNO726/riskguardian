"""
Analytics Routes - 100% Accurate MT5 Data
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, date
from app.services.mt5_wrapper import get_mt5\nmt5 = get_mt5()
import logging
import json
import os
from collections import defaultdict

from app.database.database import get_db
from app.models.journal import JournalEntry

router = APIRouter(tags=["Analytics"])
logger = logging.getLogger(__name__)

# Path for storing auto-lock config (sits next to this file)
_AUTO_LOCK_CFG = os.path.join(os.path.dirname(__file__), ".auto_lock_config.json")


# ─────────────────────────────────────────────────────────────────────────────
# EXISTING: /performance  (unchanged)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/performance")
async def get_analytics():
    """
    Get 100% accurate trading analytics directly from MT5.
    All calculations verified against MT5 data.
    """

    logger.info("📊 Fetching analytics from MT5...")

    if not mt5.initialize():
        raise HTTPException(status_code=500, detail="MT5 not initialized")

    account_info = mt5.account_info()
    if account_info is None:
        raise HTTPException(status_code=500, detail="Cannot get MT5 account info")

    current_balance = account_info.balance
    current_equity  = account_info.equity
    current_profit  = account_info.profit
    currency        = account_info.currency

    logger.info(f"✅ Live Account: Balance={current_balance}, Equity={current_equity}")

    date_to   = datetime.now()
    date_from = date_to - timedelta(days=90)

    deals = mt5.history_deals_get(date_from, date_to)

    if deals is None:
        logger.warning("No trade history found")
        deals = []

    closed_trades = []
    for deal in deals:
        if deal.entry == 1:
            if deal.type > 1:
                continue
            closed_trades.append({
                "ticket":     deal.ticket,
                "time":       deal.time,
                "symbol":     deal.symbol,
                "volume":     deal.volume,
                "profit":     deal.profit,
                "commission": deal.commission,
                "swap":       deal.swap,
                "type":       deal.type,
                "price":      deal.price,
            })

    logger.info(f"✅ Found {len(closed_trades)} closed trades")

    total_trades = len(closed_trades)

    if total_trades == 0:
        return {
            "balance":        current_balance,
            "equity":         current_equity,
            "current_profit": current_profit,
            "currency":       currency,
            "return_pct":     0,
            "max_drawdown":   0,
            "win_rate":       0,
            "total_trades":   0,
            "winning_trades": 0,
            "losing_trades":  0,
            "avg_win":        0,
            "avg_loss":       0,
            "profit_factor":  0,
            "best_trade":     0,
            "worst_trade":    0,
            "best_day":       0,
            "worst_day":      0,
            "net_profit":     0,
            "total_profit":   0,
            "total_loss":     0,
            "equity_data":    [],
            "pnl_by_date":    {},
            "initial_balance": current_balance,
        }

    winning_trades = [t for t in closed_trades if t["profit"] > 0]
    losing_trades  = [t for t in closed_trades if t["profit"] < 0]

    total_profit   = sum(t["profit"] for t in winning_trades)
    total_loss     = abs(sum(t["profit"] for t in losing_trades))
    net_profit     = sum(t["profit"] for t in closed_trades)

    win_rate       = (len(winning_trades) / total_trades * 100) if total_trades > 0 else 0
    avg_win        = total_profit / len(winning_trades) if winning_trades else 0
    avg_loss       = total_loss   / len(losing_trades)  if losing_trades  else 0
    profit_factor  = total_profit / total_loss if total_loss > 0 else (total_profit if total_profit > 0 else 0)

    all_profits = [t["profit"] for t in closed_trades]
    best_trade  = max(all_profits) if all_profits else 0
    worst_trade = min(all_profits) if all_profits else 0

    trades_by_date: dict = defaultdict(list)
    for trade in closed_trades:
        date_key = datetime.fromtimestamp(trade["time"]).strftime("%Y-%m-%d")
        trades_by_date[date_key].append(trade)

    daily_pnl = {
        k: round(sum(t["profit"] for t in v), 2)
        for k, v in trades_by_date.items()
    }

    logger.info(f"Daily P&L calculated for {len(daily_pnl)} days")

    best_day  = max(daily_pnl.values()) if daily_pnl else 0
    worst_day = min(daily_pnl.values()) if daily_pnl else 0

    initial_balance = current_balance - net_profit
    equity_curve    = []
    running_balance = initial_balance
    peak_balance    = initial_balance

    for i in range(30):
        d        = datetime.now() - timedelta(days=29 - i)
        date_key = d.strftime("%Y-%m-%d")

        day_profit = sum(
            t["profit"]
            for t in closed_trades
            if datetime.fromtimestamp(t["time"]).strftime("%Y-%m-%d") == date_key
        )

        running_balance += day_profit
        if running_balance > peak_balance:
            peak_balance = running_balance

        equity_curve.append({
            "date":      d.strftime("%b %d"),
            "balance":   round(running_balance, 2),
            "drawdown":  round(running_balance - peak_balance, 2),
        })

    return_pct     = ((current_balance - initial_balance) / initial_balance * 100) if initial_balance > 0 else 0

    peak           = initial_balance
    max_dd         = 0
    max_dd_percent = 0

    for point in equity_curve:
        if point["balance"] > peak:
            peak = point["balance"]
        drawdown_amount  = peak - point["balance"]
        drawdown_percent = (drawdown_amount / peak * 100) if peak > 0 else 0
        if drawdown_percent > max_dd_percent:
            max_dd_percent = drawdown_percent
            max_dd         = drawdown_amount

    result = {
        "balance":             round(current_balance, 2),
        "equity":              round(current_equity, 2),
        "current_profit":      round(current_profit, 2),
        "currency":            currency,
        "return_pct":          round(return_pct, 2),
        "max_drawdown":        round(max_dd, 2),
        "max_drawdown_percent":round(max_dd_percent, 2),
        "win_rate":            round(win_rate, 1),
        "total_trades":        total_trades,
        "winning_trades":      len(winning_trades),
        "losing_trades":       len(losing_trades),
        "avg_win":             round(avg_win, 2),
        "avg_loss":            round(avg_loss, 2),
        "profit_factor":       round(profit_factor, 2),
        "best_trade":          round(best_trade, 2),
        "worst_trade":         round(worst_trade, 2),
        "best_day":            round(best_day, 2),
        "worst_day":           round(worst_day, 2),
        "net_profit":          round(net_profit, 2),
        "total_profit":        round(total_profit, 2),
        "total_loss":          round(total_loss, 2),
        "equity_data":         equity_curve,
        "pnl_by_date":         daily_pnl,
        "initial_balance":     round(initial_balance, 2),
    }

    logger.info(f"✅ Analytics: {total_trades} trades, {win_rate:.1f}% win rate, ${net_profit:.2f} net P&L")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# EXISTING: lightweight helpers (unchanged)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/equity-curve")
async def get_equity_curve(days: int = 30):
    """Get equity curve data — lightweight version"""
    try:
        analytics = await get_analytics()
        return {"data": analytics["equity_data"]}
    except Exception as e:
        logger.error(f"Error getting equity curve: {e}")
        return {"error": str(e), "data": []}


@router.get("/calendar-pnl")
async def get_calendar_pnl(days: int = 60):
    """Get P&L by date for calendar view"""
    try:
        analytics = await get_analytics()
        return {"data": analytics["pnl_by_date"]}
    except Exception as e:
        logger.error(f"Error getting calendar P&L: {e}")
        return {"error": str(e), "data": {}}


@router.get("/drawdown-stats")
async def get_drawdown_stats():
    """Get detailed drawdown statistics"""
    try:
        analytics = await get_analytics()
        return {
            "max_drawdown":         analytics["max_drawdown"],
            "max_drawdown_percent": analytics.get("max_drawdown_percent", 0),
            "current_drawdown":     0,
            "current_drawdown_percent": 0,
            "peak_balance":         analytics["balance"] + analytics["max_drawdown"],
        }
    except Exception as e:
        logger.error(f"Error getting drawdown stats: {e}")
        return {"error": str(e)}


# ═════════════════════════════════════════════════════════════════════════════
# NEW: RISK LOCK HISTORY
# Reads RISK_LOCK entries from the journal and returns aggregated stats for
# the Analytics tab → Lock History section.
# ═════════════════════════════════════════════════════════════════════════════
@router.get("/lock-history")
async def get_lock_history(db: Session = Depends(get_db)):
    """
    Returns lock history stats for the Analytics → Lock History panel:
      - KPIs: total locks, locks this week, avg duration, most common reason
      - Weekly bar chart data (last 8 weeks)
      - Reason breakdown (for horizontal bars)
      - Recent events list (last 20)
    """

    events = (
        db.query(JournalEntry)
        .filter(JournalEntry.symbol == "RISK_LOCK")
        .order_by(JournalEntry.date.desc())
        .limit(100)
        .all()
    )

    if not events:
        return {
            "total_locks":          0,
            "locks_this_week":      0,
            "locks_last_week":      0,
            "avg_duration_minutes": 0,
            "most_common_reason":   "N/A",
            "reason_breakdown":     {},
            "weekly_counts":        [],
            "recent_events":        [],
        }

    now           = datetime.utcnow()
    week_ago      = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)

    locks_this_week = 0
    locks_last_week = 0
    total_duration  = 0
    duration_count  = 0
    reason_counts: dict[str, int] = defaultdict(int)
    serialized_events = []

    reason_labels_map = {
        "revenge_trade":    "😤 Revenge Trade",
        "revenge_detected": "😤 Revenge Trade",
        "loss_limit":       "📉 Loss Limit",
        "manual":           "🧘 Manual",
        "auto_loss_limit":  "🤖 Auto Loss",
        "risk_lock":        "🔒 Risk Lock",
    }

    for e in events:
        event_date = e.date or e.entry_date

        # ── Week buckets ──────────────────────────────────────────────────────
        if event_date and event_date >= week_ago:
            locks_this_week += 1
        elif event_date and event_date >= two_weeks_ago:
            locks_last_week += 1

        # ── Parse structured metadata from ai_feedback ────────────────────────
        # Format stored by journal.py: "LOCK_EVENT|reason|duration_minutes|triggered_by"
        reason       = "manual"
        duration     = 60
        triggered_by = "button"

        if e.ai_feedback and e.ai_feedback.startswith("LOCK_EVENT|"):
            parts = e.ai_feedback.split("|")
            if len(parts) >= 4:
                reason       = parts[1]
                triggered_by = parts[3]
                try:
                    duration = int(parts[2])
                except ValueError:
                    duration = 60

        reason_counts[reason] += 1
        total_duration += duration
        duration_count += 1

        serialized_events.append({
            "id":                    e.id,
            "date":                  e.date.isoformat() if e.date else None,
            "reason":                reason,
            "reason_label":          reason_labels_map.get(reason, reason.replace("_", " ").title()),
            "duration_minutes":      duration,
            "triggered_by":          triggered_by,
            "daily_loss_at_trigger": e.profit_loss,
            "notes":                 e.notes or "",
        })

    avg_duration  = round(total_duration / duration_count) if duration_count > 0 else 0
    most_common   = max(reason_counts, key=reason_counts.get) if reason_counts else "manual"

    # ── Weekly counts (last 8 weeks) ──────────────────────────────────────────
    weekly_counts = []
    for w in range(7, -1, -1):
        week_start = now - timedelta(days=(w + 1) * 7)
        week_end   = now - timedelta(days=w * 7)
        count = sum(
            1 for e in events
            if e.date and week_start <= e.date < week_end
        )
        label = (now - timedelta(days=w * 7)).strftime("W%U")
        weekly_counts.append({"week": label, "count": count})

    return {
        "total_locks":          len(events),
        "locks_this_week":      locks_this_week,
        "locks_last_week":      locks_last_week,
        "avg_duration_minutes": avg_duration,
        "most_common_reason":   reason_labels_map.get(most_common, most_common),
        "reason_breakdown":     {
            reason_labels_map.get(k, k): v
            for k, v in reason_counts.items()
        },
        "weekly_counts":        weekly_counts,
        "recent_events":        serialized_events[:20],
    }


# ═════════════════════════════════════════════════════════════════════════════
# NEW: AUTO-LOCK CONFIG
# Stores / retrieves the auto-lock threshold settings used by the background
# watcher in cooldown.py.  Settings are persisted in a local JSON file so they
# survive restarts without a database migration.
# ═════════════════════════════════════════════════════════════════════════════
def _read_auto_lock_config() -> dict:
    try:
        with open(_AUTO_LOCK_CFG) as f:
            return json.load(f)
    except Exception:
        return {"enabled": False, "loss_threshold_pct": 2.0, "cooldown_minutes": 60}


@router.get("/auto-lock-config")
async def get_auto_lock_config():
    """Return the current auto-lock configuration."""
    return _read_auto_lock_config()


@router.post("/auto-lock-config")
async def save_auto_lock_config(config: dict):
    """
    Save auto-lock configuration.
    Payload: { "enabled": true, "loss_threshold_pct": 2.0, "cooldown_minutes": 60 }
    """
    with open(_AUTO_LOCK_CFG, "w") as f:
        json.dump(config, f, indent=2)
    logger.info(f"Auto-lock config saved: {config}")
    return {"success": True, "config": config}


