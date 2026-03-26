"""
Analytics Routes — Multi-Broker Provider System
================================================
Priority order:
  1. Deriv        → Deriv WebSocket API     (free, no third party)
  2. OANDA        → OANDA REST API v20      (free, no third party)
  3. Other MT5    → MetaApi cloud           (paid, future — stub ready)

All analytics math is IDENTICAL to the original.
Only the data-fetch layer changes per broker.

Setup required (Render env vars):
  DERIV_APP_ID      — from developers.deriv.com  (free)
  OANDA_BASE_URL    — https://api-fxtrade.oanda.com  (live)
                      https://api-fxpractice.oanda.com (demo)
  META_API_TOKEN    — from app.metaapi.cloud (future / optional)
"""

from __future__ import annotations

import json
import logging
import os
from collections import defaultdict
from datetime import datetime, timedelta

import httpx
import websockets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.routes.auth_multi import get_current_user
from app.utils.encryption import decrypt_password
from app.database.database import get_db
from app.models.journal import JournalEntry
from app.models.user import TradingAccount, User

router = APIRouter(tags=["Analytics"])
logger = logging.getLogger(__name__)

_AUTO_LOCK_CFG = os.path.join(os.path.dirname(__file__), ".auto_lock_config.json")

# ─────────────────────────────────────────────────────────────────────────────
# ENV
# ─────────────────────────────────────────────────────────────────────────────
DERIV_APP_ID   = os.getenv("DERIV_APP_ID", "1089")
OANDA_BASE_URL = os.getenv("OANDA_BASE_URL", "https://api-fxtrade.oanda.com")
META_API_TOKEN = os.getenv("META_API_TOKEN", "")


# ═════════════════════════════════════════════════════════════════════════════
# BROKER PROVIDER LAYER
# ═════════════════════════════════════════════════════════════════════════════

async def _fetch_deriv(account: TradingAccount, days: int = 90) -> dict:
    token     = decrypt_password(account.encrypted_password)
    ws_url    = f"wss://ws.binaryws.com/websockets/v3?app_id={DERIV_APP_ID}"
    date_to   = int(datetime.utcnow().timestamp())
    date_from = int((datetime.utcnow() - timedelta(days=days)).timestamp())

    try:
        async with websockets.connect(ws_url) as ws:
            await ws.send(json.dumps({"authorize": token}))
            auth_resp = json.loads(await ws.recv())

            if "error" in auth_resp:
                raise HTTPException(
                    status_code=401,
                    detail=f"Deriv auth failed: {auth_resp['error']['message']}"
                )

            auth_data = auth_resp["authorize"]
            balance   = float(auth_data.get("balance", 0))
            currency  = auth_data.get("currency", "USD")
            equity    = balance

            await ws.send(json.dumps({
                "profit_table": 1,
                "description":  1,
                "sort":         "DESC",
                "date_from":    date_from,
                "date_to":      date_to,
                "limit":        500,
            }))
            pt_resp = json.loads(await ws.recv())

            if "error" in pt_resp:
                logger.warning(f"Deriv profit_table error: {pt_resp['error']['message']}")
                transactions = []
            else:
                transactions = pt_resp.get("profit_table", {}).get("transactions", [])

        deals = []
        for tx in transactions:
            profit = float(tx.get("sell_price", 0)) - float(tx.get("buy_price", 0))
            deals.append({
                "ticket":     str(tx.get("transaction_id", "")),
                "time":       float(tx.get("sell_time", tx.get("purchase_time", 0))),
                "symbol":     tx.get("shortcode", tx.get("contract_type", "")),
                "volume":     float(tx.get("payout", 0)),
                "profit":     profit,
                "commission": 0.0,
                "swap":       0.0,
                "price":      float(tx.get("sell_price", 0)),
            })

        return {
            "balance":  balance,
            "equity":   equity,
            "profit":   0.0,
            "currency": currency,
            "deals":    deals,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Deriv fetch error: {e}")
        raise HTTPException(status_code=503, detail=f"Deriv connection failed: {str(e)}")


async def _fetch_oanda(account: TradingAccount, days: int = 90) -> dict:
    token      = decrypt_password(account.encrypted_password)
    account_id = account.account_number
    date_from  = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type":  "application/json",
    }

    async with httpx.AsyncClient(base_url=OANDA_BASE_URL, headers=headers, timeout=30) as client:
        r = await client.get(f"/v3/accounts/{account_id}/summary")
        if r.status_code == 401:
            raise HTTPException(status_code=401, detail="OANDA API token is invalid")
        if r.status_code != 200:
            raise HTTPException(status_code=503, detail=f"OANDA account fetch failed: {r.text}")

        acct     = r.json().get("account", {})
        balance  = float(acct.get("balance",      0))
        equity   = float(acct.get("NAV",          balance))
        profit   = float(acct.get("unrealizedPL", 0))
        currency = acct.get("currency", "USD")

        r2 = await client.get(
            f"/v3/accounts/{account_id}/transactions",
            params={"from": date_from, "type": "ORDER_FILL"},
        )
        if r2.status_code != 200:
            logger.warning(f"OANDA transactions fetch failed: {r2.text}")
            transactions = []
        else:
            transactions = r2.json().get("transactions", [])

    deals = []
    for tx in transactions:
        pl = float(tx.get("pl", 0) or 0)
        if pl == 0 and not tx.get("tradesClosed") and not tx.get("tradeReduced"):
            continue
        try:
            ts = datetime.fromisoformat(
                tx.get("time", "").replace("Z", "+00:00")
            ).timestamp()
        except Exception:
            ts = 0.0
        deals.append({
            "ticket":     str(tx.get("id", "")),
            "time":       ts,
            "symbol":     tx.get("instrument", ""),
            "volume":     abs(float(tx.get("units",      0) or 0)),
            "profit":     pl,
            "commission": float(tx.get("commission", 0) or 0),
            "swap":       float(tx.get("financing",  0) or 0),
            "price":      float(tx.get("price",      0) or 0),
        })

    return {
        "balance":  balance,
        "equity":   equity,
        "profit":   profit,
        "currency": currency,
        "deals":    deals,
    }


async def _fetch_metaapi(account: TradingAccount, days: int = 90) -> dict:
    if not META_API_TOKEN:
        raise HTTPException(
            status_code=503,
            detail=(
                "This broker requires MetaApi integration which is not yet configured. "
                "Please connect a Deriv or OANDA account, or contact support."
            ),
        )
    raise HTTPException(
        status_code=501,
        detail="MetaApi integration coming soon. Please use Deriv or OANDA for now.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# PROVIDER ROUTER
# ─────────────────────────────────────────────────────────────────────────────
DERIV_BROKER_NAMES = {"deriv", "binary", "binary.com", "deriv.com"}
OANDA_BROKER_NAMES = {"oanda", "oanda.com"}


async def _fetch_data(account: TradingAccount, days: int = 90) -> dict:
    broker = (account.broker_name or "").lower().strip()
    if broker in DERIV_BROKER_NAMES:
        logger.info(f"🟢 Deriv provider → account {account.id}")
        return await _fetch_deriv(account, days)
    if broker in OANDA_BROKER_NAMES:
        logger.info(f"🟢 OANDA provider → account {account.id}")
        return await _fetch_oanda(account, days)
    logger.info(f"🔵 MetaApi provider → account {account.id} (broker: {broker})")
    return await _fetch_metaapi(account, days)


def _get_default_account(user: User, db: Session) -> TradingAccount:
    account = (
        db.query(TradingAccount)
        .filter_by(user_id=user.id, is_active=True, is_default=True)
        .first()
    ) or (
        db.query(TradingAccount)
        .filter_by(user_id=user.id, is_active=True)
        .first()
    )
    if not account:
        raise HTTPException(status_code=400, detail="No active trading account connected")
    return account


# ═════════════════════════════════════════════════════════════════════════════
# ANALYTICS MATH
# ═════════════════════════════════════════════════════════════════════════════
def _compute_analytics(data: dict) -> dict:
    current_balance = data["balance"]
    current_equity  = data["equity"]
    current_profit  = data["profit"]
    currency        = data["currency"]
    closed_trades   = data["deals"]
    total_trades    = len(closed_trades)

    if total_trades == 0:
        return {
            "balance":         current_balance, "equity":          current_equity,
            "current_profit":  current_profit,  "currency":        currency,
            "return_pct":      0,               "max_drawdown":    0,
            "win_rate":        0,               "total_trades":    0,
            "winning_trades":  0,               "losing_trades":   0,
            "avg_win":         0,               "avg_loss":        0,
            "profit_factor":   0,               "best_trade":      0,
            "worst_trade":     0,               "best_day":        0,
            "worst_day":       0,               "net_profit":      0,
            "total_profit":    0,               "total_loss":      0,
            "equity_data":     [],              "pnl_by_date":     {},
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
    profit_factor  = (
        total_profit / total_loss if total_loss > 0
        else (total_profit if total_profit > 0 else 0)
    )
    all_profits    = [t["profit"] for t in closed_trades]
    best_trade     = max(all_profits) if all_profits else 0
    worst_trade    = min(all_profits) if all_profits else 0

    trades_by_date: dict = defaultdict(list)
    for trade in closed_trades:
        date_key = datetime.utcfromtimestamp(trade["time"]).strftime("%Y-%m-%d")
        trades_by_date[date_key].append(trade)

    daily_pnl = {
        k: round(sum(t["profit"] for t in v), 2)
        for k, v in trades_by_date.items()
    }
    best_day  = max(daily_pnl.values()) if daily_pnl else 0
    worst_day = min(daily_pnl.values()) if daily_pnl else 0

    initial_balance = current_balance - net_profit
    equity_curve    = []
    running_balance = initial_balance
    peak_balance    = initial_balance

    for i in range(30):
        d          = datetime.utcnow() - timedelta(days=29 - i)
        date_key   = d.strftime("%Y-%m-%d")
        day_profit = sum(
            t["profit"] for t in closed_trades
            if datetime.utcfromtimestamp(t["time"]).strftime("%Y-%m-%d") == date_key
        )
        running_balance += day_profit
        if running_balance > peak_balance:
            peak_balance = running_balance
        equity_curve.append({
            "date":     d.strftime("%b %d"),
            "balance":  round(running_balance, 2),
            "drawdown": round(running_balance - peak_balance, 2),
        })

    return_pct     = (
        (current_balance - initial_balance) / initial_balance * 100
        if initial_balance > 0 else 0
    )
    peak           = initial_balance
    max_dd         = 0
    max_dd_percent = 0

    for point in equity_curve:
        if point["balance"] > peak:
            peak = point["balance"]
        dd_amt  = peak - point["balance"]
        dd_pct  = (dd_amt / peak * 100) if peak > 0 else 0
        if dd_pct > max_dd_percent:
            max_dd_percent = dd_pct
            max_dd         = dd_amt

    return {
        "balance":              round(current_balance, 2),
        "equity":               round(current_equity,  2),
        "current_profit":       round(current_profit,  2),
        "currency":             currency,
        "return_pct":           round(return_pct,      2),
        "max_drawdown":         round(max_dd,           2),
        "max_drawdown_percent": round(max_dd_percent,   2),
        "win_rate":             round(win_rate,         1),
        "total_trades":         total_trades,
        "winning_trades":       len(winning_trades),
        "losing_trades":        len(losing_trades),
        "avg_win":              round(avg_win,          2),
        "avg_loss":             round(avg_loss,         2),
        "profit_factor":        round(profit_factor,    2),
        "best_trade":           round(best_trade,       2),
        "worst_trade":          round(worst_trade,      2),
        "best_day":             round(best_day,         2),
        "worst_day":            round(worst_day,        2),
        "net_profit":           round(net_profit,       2),
        "total_profit":         round(total_profit,     2),
        "total_loss":           round(total_loss,       2),
        "equity_data":          equity_curve,
        "pnl_by_date":          daily_pnl,
        "initial_balance":      round(initial_balance,  2),
    }


# ═════════════════════════════════════════════════════════════════════════════
# ROUTES
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/performance")
async def get_analytics(
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    logger.info(f"📊 Fetching analytics for user {current_user.id}...")
    account = _get_default_account(current_user, db)
    data    = await _fetch_data(account, days=90)
    result  = _compute_analytics(data)
    logger.info(
        f"✅ Analytics: {result['total_trades']} trades, "
        f"{result['win_rate']}% win rate, ${result['net_profit']} net P&L"
    )
    return result


@router.get("/equity-curve")
async def get_equity_curve(
    days:         int     = 30,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    try:
        analytics = await get_analytics(current_user=current_user, db=db)
        return {"data": analytics["equity_data"]}
    except Exception as e:
        logger.error(f"Error getting equity curve: {e}")
        return {"error": str(e), "data": []}


@router.get("/calendar-pnl")
async def get_calendar_pnl(
    days:         int     = 60,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    try:
        analytics = await get_analytics(current_user=current_user, db=db)
        return {"data": analytics["pnl_by_date"]}
    except Exception as e:
        logger.error(f"Error getting calendar P&L: {e}")
        return {"error": str(e), "data": {}}


@router.get("/drawdown-stats")
async def get_drawdown_stats(
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    try:
        analytics = await get_analytics(current_user=current_user, db=db)
        return {
            "max_drawdown":             analytics["max_drawdown"],
            "max_drawdown_percent":     analytics.get("max_drawdown_percent", 0),
            "current_drawdown":         0,
            "current_drawdown_percent": 0,
            "peak_balance":             analytics["balance"] + analytics["max_drawdown"],
        }
    except Exception as e:
        logger.error(f"Error getting drawdown stats: {e}")
        return {"error": str(e)}


@router.get("/lock-history")
async def get_lock_history(
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    events = (
        db.query(JournalEntry)
        .filter(
            JournalEntry.symbol  == "RISK_LOCK",
            JournalEntry.user_id == current_user.id,
        )
        .order_by(JournalEntry.date.desc())
        .limit(100)
        .all()
    )

    if not events:
        return {
            "total_locks": 0, "locks_this_week": 0, "locks_last_week": 0,
            "avg_duration_minutes": 0, "most_common_reason": "N/A",
            "reason_breakdown": {}, "weekly_counts": [], "recent_events": [],
        }

    now           = datetime.utcnow()
    week_ago      = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)

    locks_this_week = locks_last_week = total_duration = duration_count = 0
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
        if event_date and event_date >= week_ago:
            locks_this_week += 1
        elif event_date and event_date >= two_weeks_ago:
            locks_last_week += 1

        reason = "manual"; duration = 60; triggered_by = "button"
        if e.ai_feedback and e.ai_feedback.startswith("LOCK_EVENT|"):
            parts = e.ai_feedback.split("|")
            if len(parts) >= 4:
                reason = parts[1]; triggered_by = parts[3]
                try:    duration = int(parts[2])
                except: duration = 60

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

    avg_duration = round(total_duration / duration_count) if duration_count > 0 else 0
    most_common  = max(reason_counts, key=reason_counts.get) if reason_counts else "manual"
    weekly_counts = []
    for w in range(7, -1, -1):
        ws = now - timedelta(days=(w + 1) * 7)
        we = now - timedelta(days=w * 7)
        count = sum(1 for e in events if e.date and ws <= e.date < we)
        weekly_counts.append({"week": (now - timedelta(days=w * 7)).strftime("W%U"), "count": count})

    return {
        "total_locks":          len(events),
        "locks_this_week":      locks_this_week,
        "locks_last_week":      locks_last_week,
        "avg_duration_minutes": avg_duration,
        "most_common_reason":   reason_labels_map.get(most_common, most_common),
        "reason_breakdown":     {reason_labels_map.get(k, k): v for k, v in reason_counts.items()},
        "weekly_counts":        weekly_counts,
        "recent_events":        serialized_events[:20],
    }


def _read_auto_lock_config() -> dict:
    try:
        with open(_AUTO_LOCK_CFG) as f:
            return json.load(f)
    except Exception:
        return {"enabled": False, "loss_threshold_pct": 2.0, "cooldown_minutes": 60}


@router.get("/auto-lock-config")
async def get_auto_lock_config():
    return _read_auto_lock_config()


@router.post("/auto-lock-config")
async def save_auto_lock_config(config: dict):
    with open(_AUTO_LOCK_CFG, "w") as f:
        json.dump(config, f, indent=2)
    logger.info(f"Auto-lock config saved: {config}")
    return {"success": True, "config": config}


@router.get("/broker-config/{broker_name}")
async def get_broker_config(broker_name: str):
    broker = broker_name.lower().strip()

    if broker in DERIV_BROKER_NAMES:
        return {
            "broker":       "Deriv",
            "method":       "api_token",
            "fields":       ["api_token"],
            "instructions": (
                "Go to app.deriv.com → Account Settings → API Token. "
                "Create a token with 'Read' and 'Trading information' scopes."
            ),
            "token_url": "https://app.deriv.com/account/api-token",
        }

    if broker in OANDA_BROKER_NAMES:
        return {
            "broker":       "OANDA",
            "method":       "api_token",
            "fields":       ["account_id", "api_token"],
            "instructions": (
                "Log in to OANDA → My Services → Manage API Access. "
                "Generate a personal access token and copy your Account ID."
            ),
            "token_url": "https://www.oanda.com/account/management-portal",
        }

    return {
        "broker":       broker_name,
        "method":       "mt5_credentials",
        "fields":       ["account_number", "password", "server"],
        "instructions": (
            "Enter your MT5 account number, password, and broker server. "
            "MetaApi integration will be activated for live data (coming soon)."
        ),
        "token_url": None,
    }



