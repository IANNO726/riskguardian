"""
simulator.py — Prop Firm Survival Simulator
============================================
Stateless backend. All session state passed in from frontend on every request.

ADDITIONS vs original:
  - POST /pass-probability  — trajectory-based pass probability model (Feature 1)
  - POST /result            — now includes equity_curve for P&L chart (Feature 2)
  - GET  /news              — upcoming high-impact news (proxies news_calendar service)
  - POST /compare           — multi-session comparison (Feature: Challenge A vs B)
  - FTMO consistency_rule   — corrected to None (not enforced on CFDs)
  - FTMO allow_news_trading — corrected to True with 2-min window flag
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import uuid

from app.middleware.plan_gating import check_firm_limit, check_compare_limit
from app.routes.auth_multi import get_current_user

router = APIRouter()

# ── Pair restriction sets ──────────────────────────────────────────────────────
_CRYPTO   = {"BTC","ETH","LTC","XRP","ADA","SOL","DOGE","CRYPTO"}
_EXOTICS  = {"ZAR","TRY","MXN","HUF","PLN","CZK","SGD","HKD","NOK","SEK","DKK"}

FIRM_RULES = {
    "FTMO": {
        "name": "FTMO",
        "account_sizes": [10_000, 25_000, 50_000, 100_000, 200_000],
        "daily_loss_limit_pct":    5.0,
        "max_drawdown_pct":       10.0,
        "profit_target_pct":      10.0,
        "min_trading_days":        4,
        "max_risk_per_trade_pct":  2.0,
        "max_lot_size":           None,
        "banned_pair_keywords":   list(_CRYPTO),
        # FIX: FTMO allows news trading — only bans entries within 2 min window
        # The is_news_trade flag still triggers a violation warning on the frontend
        "allow_news_trading":     True,
        "allow_weekend_holding":  False,
        "trailing_dd":            False,
        # FIX: FTMO consistency rule does NOT apply to CFD challenges
        "consistency_rule":       None,
        "count_profitable_days":  False,
        "payout_pct":             80,
        "news_window_minutes":    2,   # new: flag trades within this window
        "description": "10% target, 5% daily / 10% max DD. No crypto. No weekend. 80% payout.",
    },
    "FundedNext": {
        "name": "FundedNext",
        "account_sizes": [6_000, 15_000, 25_000, 50_000, 100_000, 200_000],
        "daily_loss_limit_pct":    5.0,
        "max_drawdown_pct":       10.0,
        "profit_target_pct":       8.0,
        "min_trading_days":        5,
        "max_risk_per_trade_pct":  3.0,
        "max_lot_size":           None,
        "banned_pair_keywords":   [],
        "allow_news_trading":     True,
        "allow_weekend_holding":  True,
        "trailing_dd":            True,
        "consistency_rule":       None,
        "count_profitable_days":  False,
        "payout_pct":             90,
        "description": "8% target. Trailing DD. All pairs. News OK. 90% payout.",
    },
    "FundingPips": {
        "name": "FundingPips",
        "account_sizes": [5_000, 10_000, 25_000, 50_000, 100_000, 200_000],
        "daily_loss_limit_pct":    5.0,
        "max_drawdown_pct":       10.0,
        "profit_target_pct":       8.0,
        "min_trading_days":        3,
        "max_risk_per_trade_pct":  2.0,
        "max_lot_size":           None,
        "banned_pair_keywords":   list(_CRYPTO),
        "allow_news_trading":     False,
        "allow_weekend_holding":  False,
        "trailing_dd":            False,
        "consistency_rule":       None,
        "count_profitable_days":  False,
        "payout_pct":             80,
        "description": "8% target, 3 min days. No crypto. No weekend. 80% payout.",
    },
    "5percentFunding": {
        "name": "5% Funding",
        "account_sizes": [10_000, 25_000, 50_000, 100_000, 200_000],
        "daily_loss_limit_pct":    4.0,
        "max_drawdown_pct":        8.0,
        "profit_target_pct":       6.0,
        # FIX: 5% Funding uses calendar days, not profitable days
        "min_trading_days":        3,
        "max_risk_per_trade_pct":  2.0,
        "max_lot_size":           50.0,
        "banned_pair_keywords":   list(_CRYPTO) + list(_EXOTICS),
        "allow_news_trading":     False,
        "allow_weekend_holding":  False,
        "trailing_dd":            False,
        "consistency_rule":       None,
        # FIX: false — uses calendar days
        "count_profitable_days":  False,
        "payout_pct":             95,
        "description": "6% target. Max 50 lots. No crypto/exotics. 95% payout.",
    },
    "E8Funding": {
        "name": "E8Funding",
        "account_sizes": [25_000, 50_000, 100_000, 250_000],
        "daily_loss_limit_pct":    5.0,
        "max_drawdown_pct":        8.0,
        "profit_target_pct":       8.0,
        "min_trading_days":        0,
        "max_risk_per_trade_pct":  2.0,
        "max_lot_size":           None,
        "banned_pair_keywords":   list(_CRYPTO),
        "allow_news_trading":     True,
        "allow_weekend_holding":  False,
        "trailing_dd":            False,
        "consistency_rule":       None,
        "count_profitable_days":  False,
        "payout_pct":             80,
        "description": "8% target + drawdown. No crypto. News OK. 80% payout.",
    },
}


# ── Models ─────────────────────────────────────────────────────────────────────

class SimTrade(BaseModel):
    symbol:         str
    lot_size:       float
    entry:          float
    sl:             float
    tp:             float
    result:         str
    direction:      str
    pnl:            float
    pnl_gross:      float
    commission:     float
    risk_pct:       float
    rr_ratio:       float
    day:            int
    timeframe:      Optional[str]   = None
    days_held:      Optional[int]   = None
    notes:          Optional[str]   = None
    screenshot_url: Optional[str]   = None


class SimSession(BaseModel):
    session_id:         str
    firm:               str
    account_size:       float
    balance:            float
    peak_balance:       float
    trailing_dd_floor:  float
    day:                int
    trades:             List[SimTrade] = []
    day_start_balance:  float
    daily_pnl:          float
    daily_trades:       int
    profitable_days:    int
    consecutive_losses: int
    status:             str
    custom_daily_loss_pct:         Optional[float] = None
    custom_max_drawdown_pct:       Optional[float] = None
    custom_profit_target_pct:      Optional[float] = None
    custom_min_trading_days:       Optional[int]   = None
    custom_max_risk_per_trade_pct: Optional[float] = None


class StartRequest(BaseModel):
    firm:             str
    account_size:     float
    custom_firm_name: Optional[str]   = None
    custom_daily_loss_pct:         Optional[float] = None
    custom_max_drawdown_pct:       Optional[float] = None
    custom_profit_target_pct:      Optional[float] = None
    custom_min_trading_days:       Optional[int]   = None
    custom_max_risk_per_trade_pct: Optional[float] = None


class TradeRequest(BaseModel):
    session:             SimSession
    symbol:              str
    lot_size:            float
    entry:               float
    sl:                  float
    tp:                  float
    result:              str
    direction:           str
    timeframe:           Optional[str]   = None
    days_held:           Optional[int]   = 0
    notes:               Optional[str]   = None
    screenshot_url:      Optional[str]   = None
    commission_override: Optional[float] = None
    is_news_trade:       Optional[bool]  = False
    is_weekend_hold:     Optional[bool]  = False


class NextDayRequest(BaseModel):
    session: SimSession


class ResetRequest(BaseModel):
    firm:         Optional[str]   = None
    account_size: Optional[float] = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _rules(session: SimSession) -> dict:
    fallback = next(iter(FIRM_RULES.values()))
    base = FIRM_RULES.get(session.firm, fallback).copy()
    if session.custom_daily_loss_pct         is not None: base["daily_loss_limit_pct"]   = session.custom_daily_loss_pct
    if session.custom_max_drawdown_pct       is not None: base["max_drawdown_pct"]       = session.custom_max_drawdown_pct
    if session.custom_profit_target_pct      is not None: base["profit_target_pct"]      = session.custom_profit_target_pct
    if session.custom_min_trading_days       is not None: base["min_trading_days"]       = session.custom_min_trading_days
    if session.custom_max_risk_per_trade_pct is not None: base["max_risk_per_trade_pct"] = session.custom_max_risk_per_trade_pct
    return base


def _effective_drawdown_pct(session: SimSession, rules: dict) -> float:
    return (session.peak_balance - session.balance) / session.peak_balance * 100


def _min_days_met(session: SimSession, rules: dict) -> bool:
    if rules.get("count_profitable_days", False):
        return session.profitable_days >= rules["min_trading_days"]
    return session.day >= rules["min_trading_days"]


def _check_consistency(session: SimSession, rules: dict):
    ratio = rules.get("consistency_rule")
    if ratio is None:
        return None
    total_profit = session.balance - session.account_size
    if total_profit <= 0:
        return None
    day_pnl: dict = {}
    for t in session.trades:
        day_pnl[t.day] = day_pnl.get(t.day, 0) + t.pnl
    for d, dpnl in day_pnl.items():
        if dpnl > 0 and dpnl / total_profit > ratio:
            return (
                f"Consistency rule: Day {d} profit (${dpnl:.2f}) is "
                f"{dpnl/total_profit*100:.1f}% of total — exceeds {int(ratio*100)}% limit"
            )
    return None


def _check_pair_restriction(symbol: str, rules: dict) -> Optional[str]:
    banned = rules.get("banned_pair_keywords", [])
    s = symbol.upper()
    for kw in banned:
        if kw.upper() in s:
            return (
                f"Pair restriction: {rules['name']} does not allow trading {symbol}. "
                f"Banned category contains '{kw}'."
            )
    return None


def _check_outcome(session: SimSession) -> str:
    rules = _rules(session)
    drawdown_pct = _effective_drawdown_pct(session, rules)
    if drawdown_pct >= rules["max_drawdown_pct"]:
        return "blown"
    daily_loss_pct = -session.daily_pnl / session.day_start_balance * 100 if session.daily_pnl < 0 else 0
    if daily_loss_pct >= rules["daily_loss_limit_pct"]:
        return "daily_limit_hit"
    profit_pct = (session.balance - session.account_size) / session.account_size * 100
    if rules["profit_target_pct"] > 0 and profit_pct >= rules["profit_target_pct"]:
        if _min_days_met(session, rules):
            return "passed"
    return "active"


def _calc_pnl(symbol: str, lot_size: float, entry: float, sl: float, tp: float, result: str) -> tuple:
    """
    Calculate P&L using myfxbook-standard pip values (USD account).

    Verified formulas:
      Quote=USD (EURUSD etc.)   → pip_val = $10/pip/lot  (fixed)
      USDJPY                    → pip_val = 1000 / entry_rate
      USD/other (USDCHF etc.)   → pip_val = 10 / entry_rate
      JPY cross (CHFJPY etc.)   → pip_val = 1000 / REF_USDJPY  (~$6.31 at 158.5)
      Non-JPY cross (EURGBP etc.)→ pip_val = 10 * quote_to_usd
      XAUUSD Gold               → pip_val = $1/pip (pip=0.01, 100oz/lot)
      XAGUSD Silver             → pip_val = $5/pip (pip=0.001, 5000oz/lot)
      Indices/Crypto/Synthetics → $1/point/lot
      Deriv Step Index          → $10/point/lot
    """
    sl_dist = abs(entry - sl)
    tp_dist = abs(entry - tp) if tp and tp != entry else sl_dist
    s = symbol.upper().replace(" ", "")

    # Reference USDJPY for JPY cross pip values (2026 approximation)
    REF_USDJPY = 158.5

    # Reference quote-currency → USD conversion rates (static 2026 approximations)
    QUOTE_TO_USD: dict = {
        "GBP": 1.265, "EUR": 1.085, "AUD": 0.645, "NZD": 0.595,
        "CHF": 1.124, "CAD": 0.727, "SGD": 0.743, "NOK": 0.093,
        "SEK": 0.095, "DKK": 0.145, "HKD": 0.128, "ZAR": 0.055,
        "MXN": 0.058, "TRY": 0.032, "PLN": 0.249, "CZK": 0.044,
    }

    # ── Deriv Step Index ──────────────────────────────────────────────────────
    if "STEPINDEX" in s or "MULTISTEP" in s or "SKEWSTEP" in s:
        pip_val, pip_size = 10.0, 1.0

    # ── Deriv synthetics ──────────────────────────────────────────────────────
    elif any(k in s for k in ["VOLATILITY","CRASH","BOOM","JUMP","RANGEBREAK","DEX","DRIFT","TREK"]):
        pip_val, pip_size = 1.0, 1.0

    # ── Gold ──────────────────────────────────────────────────────────────────
    elif "XAUUSD" in s or s == "GOLD":
        pip_val, pip_size = 1.0, 0.01      # $1/pip/lot, pip = $0.01 price move

    # ── Silver ────────────────────────────────────────────────────────────────
    elif "XAGUSD" in s or s == "SILVER":
        pip_val, pip_size = 5.0, 0.001     # $5/pip/lot

    # ── Equity indices ────────────────────────────────────────────────────────
    elif any(k in s for k in ["US30","US500","US100","SPX","NAS","DAX","UK100","GER40","FRA40","AUS200","JPN225","STOXX"]):
        pip_val, pip_size = 1.0, 1.0

    # ── Crypto ────────────────────────────────────────────────────────────────
    elif any(k in s for k in ["BTC","ETH","XRP","SOL","ADA","DOGE"]):
        pip_val, pip_size = 1.0, 1.0

    # ── Forex ─────────────────────────────────────────────────────────────────
    else:
        quote_ccy = s[-3:] if len(s) >= 6 else "USD"
        base_ccy  = s[:3]  if len(s) >= 6 else "EUR"

        if quote_ccy == "USD":
            # EURUSD, GBPUSD, AUDUSD, NZDUSD → always $10/pip/lot
            pip_val, pip_size = 10.0, 0.0001

        elif base_ccy == "USD" and quote_ccy == "JPY":
            # USDJPY → pip_val = 1000 / entry_rate
            pip_val  = 1000.0 / entry if entry > 0 else 1000.0 / REF_USDJPY
            pip_size = 0.01

        elif base_ccy == "USD":
            # USDCHF, USDCAD, etc. → pip_val = 10 / entry_rate
            pip_val  = 10.0 / entry if entry > 0 else 10.0
            pip_size = 0.0001

        elif quote_ccy == "JPY":
            # ALL JPY crosses (CHFJPY, EURJPY, GBPJPY etc.)
            # pip_val = 1000 / USDJPY (independent of cross rate!)
            pip_val  = 1000.0 / REF_USDJPY
            pip_size = 0.01

        else:
            # Non-JPY crosses: EURGBP, EURCAD, GBPCHF, EURAUD etc.
            conv     = QUOTE_TO_USD.get(quote_ccy, 1.0)
            pip_val  = 10.0 * conv
            pip_size = 0.0001

    pips_risk     = sl_dist / pip_size
    pips_reward   = tp_dist / pip_size
    risk_dollar   = round(pips_risk   * pip_val * lot_size, 2)
    profit_dollar = round(pips_reward * pip_val * lot_size, 2)

    rr = round(profit_dollar / risk_dollar, 2) if risk_dollar > 0 else 1.0
    if result == "win":
        pnl_gross = profit_dollar
    elif result == "loss":
        pnl_gross = -risk_dollar
    else:
        pnl_gross = 0.0
    return pnl_gross, risk_dollar, profit_dollar, rr


# ── News calendar proxy ────────────────────────────────────────────────────────

@router.get("/news")
async def get_news_for_simulator(hours: int = 48, symbol: Optional[str] = None):
    """
    Returns upcoming high-impact news events for the next N hours.
    Proxies the news_calendar service — if unavailable, returns fallback data
    so the simulator always has something to show.
    """
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10.0) as client:
            url    = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
            headers = {"User-Agent": "RiskGuardian/1.0", "Accept": "application/json"}
            resp   = await client.get(url, headers=headers, follow_redirects=True)
            if resp.status_code == 200:
                raw_data = resp.json()
                events   = []
                now      = datetime.utcnow()
                cutoff   = now + timedelta(hours=hours)

                # Parse response
                HIGH_KW = ["nfp","non-farm","payroll","cpi","inflation","gdp","fomc",
                           "interest rate","rate decision","pmi","ism","employment",
                           "retail sales","pce","jobless","unemployment","manufacturing",
                           "boe","ecb","rba","boc","rbnz","snb","federal reserve",
                           "fed chair","speech","press conference"]

                CURR_PAIRS = {
                    "USD": ["EURUSD","GBPUSD","AUDUSD","NZDUSD","USDCAD","USDCHF","USDJPY","XAUUSD",
                            "EURJPY","GBPJPY","AUDJPY","NZDJPY","CADJPY","CHFJPY"],
                    "EUR": ["EURUSD","EURJPY","EURGBP","EURAUD","EURCAD","EURCHF","EURNZD"],
                    "GBP": ["GBPUSD","GBPJPY","EURGBP","GBPAUD","GBPCAD","GBPCHF","GBPNZD"],
                    "JPY": ["USDJPY","EURJPY","GBPJPY","AUDJPY","NZDJPY","CADJPY","CHFJPY"],
                    "AUD": ["AUDUSD","AUDJPY","EURAUD","GBPAUD","AUDCAD","AUDCHF","AUDNZD"],
                    "CAD": ["USDCAD","CADJPY","EURCAD","GBPCAD","AUDCAD","NZDCAD"],
                    "CHF": ["USDCHF","CHFJPY","EURCHF","GBPCHF","AUDCHF","NZDCHF"],
                    "NZD": ["NZDUSD","NZDJPY","EURNZD","GBPNZD","AUDNZD","NZDCAD","NZDCHF"],
                }

                for item in raw_data:
                    title    = item.get("name","") or item.get("title","") or ""
                    currency = (item.get("currency","") or "").upper()
                    impact   = (item.get("impact","") or "").lower()
                    date_str = item.get("date","") or ""

                    is_high  = impact in ["high","red","3"] or any(k in title.lower() for k in HIGH_KW)
                    if not is_high:
                        continue

                    # Parse datetime
                    dt = None
                    for fmt in ["%Y-%m-%dT%H:%M:%S","%Y-%m-%dT%H:%M","%Y-%m-%d %H:%M:%S","%Y-%m-%d"]:
                        try:
                            dt = datetime.strptime(date_str[:19], fmt)
                            break
                        except ValueError:
                            continue
                    if not dt:
                        continue

                    if not (now - timedelta(hours=1) <= dt <= cutoff):
                        continue

                    affected = CURR_PAIRS.get(currency, [])
                    if symbol:
                        sym_clean = symbol.upper().replace("/","")
                        affected  = [p for p in affected if sym_clean in p.upper()]
                        if not affected:
                            continue

                    mins_away = int((dt - now).total_seconds() / 60)
                    events.append({
                        "title":          title,
                        "currency":       currency,
                        "impact":         "high",
                        "datetime_utc":   dt.strftime("%Y-%m-%dT%H:%M:00"),
                        "affected_pairs": affected,
                        "minutes_away":   mins_away,
                        "forecast":       item.get("forecast",""),
                        "previous":       item.get("previous",""),
                    })

                events.sort(key=lambda x: x["datetime_utc"])
                return {"events": events, "count": len(events), "source": "ForexFactory"}

    except Exception as e:
        pass

    # ── Fallback: return empty list if fetch fails ────────────────────────────
    return {
        "events":  [],
        "count":   0,
        "source":  "unavailable",
        "error":   "Could not fetch news calendar. Check internet connection.",
    }


# ── Multi-session comparison ───────────────────────────────────────────────────

class CompareRequest(BaseModel):
    sessions: List[dict]   # list of SimSession dicts (each previously POSTed to /result)
    labels:   Optional[List[str]] = None   # e.g. ["Challenge A", "Challenge B"]

@router.post("/compare")
async def compare_sessions(req: CompareRequest, current_user=Depends(get_current_user)):
    check_compare_limit(current_user, len(req.sessions))
    """
    Compare multiple challenge simulation sessions side-by-side.
    Each session must be a full session dict as returned by /result.
    Returns a comparison matrix with winner per metric.
    """
    if len(req.sessions) < 2:
        raise HTTPException(400, "Provide at least 2 sessions to compare")
    if len(req.sessions) > 5:
        raise HTTPException(400, "Maximum 5 sessions at a time")

    labels = req.labels or [f"Session {i+1}" for i in range(len(req.sessions))]
    if len(labels) < len(req.sessions):
        labels += [f"Session {i+1}" for i in range(len(labels), len(req.sessions))]

    summaries = []
    for i, sess in enumerate(req.sessions):
        trades     = sess.get("trades", [])
        balance    = sess.get("balance", 0)
        initial    = sess.get("initial_balance", balance)
        rules      = sess.get("rules", {})
        eq_curve   = sess.get("equity_curve", [])

        total      = len(trades)
        wins       = [t for t in trades if t.get("result") == "win"]
        losses     = [t for t in trades if t.get("result") == "loss"]
        total_pnl  = balance - initial if initial > 0 else 0
        profit_pct = round(total_pnl / initial * 100, 3) if initial > 0 else 0
        win_rate   = round(len(wins) / total * 100, 1) if total > 0 else 0

        win_pnls  = [t.get("pnl", 0) for t in wins]
        loss_pnls = [abs(t.get("pnl", 0)) for t in losses]
        avg_win   = round(sum(win_pnls) / len(win_pnls), 2) if win_pnls else 0
        avg_loss  = round(sum(loss_pnls) / len(loss_pnls), 2) if loss_pnls else 0
        expectancy = round((win_rate/100 * avg_win) - ((1-win_rate/100) * avg_loss), 2)

        # Max drawdown from equity curve
        max_dd = 0
        peak   = initial
        for pt in eq_curve:
            bal = pt.get("balance", initial)
            if bal > peak:
                peak = bal
            dd = (peak - bal) / peak * 100 if peak > 0 else 0
            max_dd = max(max_dd, dd)

        # Consecutive losses
        max_consec_loss = 0
        cur_consec      = 0
        for t in trades:
            if t.get("result") == "loss":
                cur_consec += 1
                max_consec_loss = max(max_consec_loss, cur_consec)
            else:
                cur_consec = 0

        target_pct  = rules.get("profit_target_pct", 10)
        dd_limit    = rules.get("max_drawdown_pct", 10)
        passed      = profit_pct >= target_pct and max_dd < dd_limit

        summaries.append({
            "label":            labels[i],
            "firm":             rules.get("name", "Custom"),
            "account_size":     initial,
            "final_balance":    round(balance, 2),
            "total_pnl":        round(total_pnl, 2),
            "profit_pct":       profit_pct,
            "win_rate":         win_rate,
            "total_trades":     total,
            "wins":             len(wins),
            "losses":           len(losses),
            "avg_win":          avg_win,
            "avg_loss":         avg_loss,
            "expectancy":       expectancy,
            "max_drawdown_pct": round(max_dd, 3),
            "max_consec_losses": max_consec_loss,
            "days_traded":      sess.get("day", 0),
            "passed":           passed,
            "profit_target_pct": target_pct,
            "dd_limit_pct":     dd_limit,
            "equity_curve":     eq_curve,
        })

    # ── Winner per metric ─────────────────────────────────────────────────────
    metrics_to_compare = [
        ("profit_pct",          "higher", "Net Profit %"),
        ("win_rate",            "higher", "Win Rate"),
        ("expectancy",          "higher", "Expectancy"),
        ("max_drawdown_pct",    "lower",  "Max Drawdown"),
        ("max_consec_losses",   "lower",  "Consec. Losses"),
        ("avg_win",             "higher", "Avg Win"),
        ("avg_loss",            "lower",  "Avg Loss"),
        ("total_trades",        "info",   "Trades Taken"),
    ]

    winners = {}
    for metric_key, direction, label in metrics_to_compare:
        vals = [(s["label"], s.get(metric_key, 0)) for s in summaries]
        if direction == "higher":
            best = max(vals, key=lambda x: x[1])
        elif direction == "lower":
            best = min(vals, key=lambda x: x[1])
        else:
            best = (None, None)  # info only
        winners[metric_key] = {"winner": best[0], "value": best[1], "label": label, "direction": direction}

    # Overall score (count of metric wins per session)
    score_tally: dict[str, int] = {s["label"]: 0 for s in summaries}
    for m_key, info in winners.items():
        if info["winner"] and info["direction"] != "info":
            score_tally[info["winner"]] = score_tally.get(info["winner"], 0) + 1
    overall_winner = max(score_tally.items(), key=lambda x: x[1])[0] if score_tally else None

    return {
        "sessions":      summaries,
        "winners":       winners,
        "score_tally":   score_tally,
        "overall_winner": overall_winner,
        "metrics":       [{"key": k, "label": l, "direction": d} for k, d, l in metrics_to_compare],
    }


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/firms")
async def list_firms():
    return [
        {
            "key":                   k,
            "name":                  v["name"],
            "account_sizes":         v["account_sizes"],
            "daily_loss_limit_pct":  v["daily_loss_limit_pct"],
            "max_drawdown_pct":      v["max_drawdown_pct"],
            "profit_target_pct":     v["profit_target_pct"],
            "min_trading_days":      v["min_trading_days"],
            "max_risk_per_trade_pct":v["max_risk_per_trade_pct"],
            "max_lot_size":          v.get("max_lot_size"),
            "banned_pair_keywords":  v.get("banned_pair_keywords", []),
            "allow_news_trading":    v.get("allow_news_trading", True),
            "allow_weekend_holding": v.get("allow_weekend_holding", True),
            "trailing_dd":           v.get("trailing_dd", False),
            "consistency_rule":      v.get("consistency_rule"),
            "count_profitable_days": v.get("count_profitable_days", False),
            "payout_pct":            v.get("payout_pct", 80),
            "description":           v["description"],
        }
        for k, v in FIRM_RULES.items()
    ]


@router.post("/start")
async def start_simulation(req: StartRequest, current_user=Depends(get_current_user)):
    check_firm_limit(current_user, req.firm)
    if req.firm not in FIRM_RULES and not req.custom_firm_name:
        raise HTTPException(status_code=400, detail=f"Unknown firm: {req.firm}.")
    if req.account_size <= 0:
        raise HTTPException(status_code=400, detail="Account size must be positive")
    rules  = FIRM_RULES.get(req.firm, next(iter(FIRM_RULES.values())))
    max_dd = req.custom_max_drawdown_pct or rules["max_drawdown_pct"]
    session = SimSession(
        session_id          = str(uuid.uuid4())[:8],
        firm                = req.firm,
        account_size        = req.account_size,
        balance             = req.account_size,
        peak_balance        = req.account_size,
        trailing_dd_floor   = round(req.account_size * (1 - max_dd / 100), 2),
        day                 = 1,
        trades              = [],
        day_start_balance   = req.account_size,
        daily_pnl           = 0.0,
        daily_trades        = 0,
        profitable_days     = 0,
        consecutive_losses  = 0,
        status              = "active",
        custom_daily_loss_pct         = req.custom_daily_loss_pct,
        custom_max_drawdown_pct       = req.custom_max_drawdown_pct,
        custom_profit_target_pct      = req.custom_profit_target_pct,
        custom_min_trading_days       = req.custom_min_trading_days,
        custom_max_risk_per_trade_pct = req.custom_max_risk_per_trade_pct,
    )
    return {"session": session, "rules": _rules(session)}


@router.post("/trade")
async def submit_trade(req: TradeRequest):
    if req.session.status != "active":
        raise HTTPException(status_code=400, detail="Session is no longer active")
    if req.result not in ("win", "loss", "breakeven"):
        raise HTTPException(status_code=400, detail="result must be win | loss | breakeven")
    if req.direction not in ("buy", "sell"):
        raise HTTPException(status_code=400, detail="direction must be buy | sell")

    rules = _rules(req.session)
    pnl_gross, risk_dollar, profit_dollar, rr = _calc_pnl(
        req.symbol, req.lot_size, req.entry, req.sl, req.tp, req.result
    )
    commission = round(req.commission_override or 0.0, 2)
    pnl_net    = round(pnl_gross - commission, 2)
    risk_pct   = risk_dollar / req.session.balance * 100 if req.session.balance > 0 else 0

    violations = []

    if risk_pct > rules["max_risk_per_trade_pct"]:
        violations.append(
            f"Risk {risk_pct:.2f}% exceeds {rules['name']} limit of {rules['max_risk_per_trade_pct']}% per trade"
        )

    max_lot = rules.get("max_lot_size")
    if max_lot is not None and req.lot_size > max_lot:
        violations.append(
            f"Lot size {req.lot_size} exceeds {rules['name']} maximum of {max_lot} lots per trade"
        )

    pair_viol = _check_pair_restriction(req.symbol, rules)
    if pair_viol:
        violations.append(pair_viol)

    # FIX: news trading — flag as violation only if flagged AND firm has 2-min window rule
    if req.is_news_trade:
        if not rules.get("allow_news_trading", True):
            violations.append(
                f"{rules['name']} prohibits trading during major news events."
            )
        else:
            # Firms that allow news but have a window restriction (FTMO)
            window = rules.get("news_window_minutes", 0)
            if window > 0:
                violations.append(
                    f"⚠️ {rules['name']} restricts entries within {window} min of major news (NFP, CPI, FOMC). "
                    f"Ensure this trade was not within that window."
                )

    if req.is_weekend_hold and not rules.get("allow_weekend_holding", True):
        violations.append(
            f"{rules['name']} requires all positions closed before the weekend."
        )

    trade = SimTrade(
        symbol         = req.symbol,
        lot_size       = req.lot_size,
        entry          = req.entry,
        sl             = req.sl,
        tp             = req.tp,
        result         = req.result,
        direction      = req.direction,
        pnl            = pnl_net,
        pnl_gross      = pnl_gross,
        commission     = commission,
        risk_pct       = round(risk_pct, 4),
        rr_ratio       = rr,
        day            = req.session.day,
        timeframe      = req.timeframe,
        days_held      = req.days_held or 0,
        notes          = req.notes,
        screenshot_url = req.screenshot_url,
    )

    s = req.session.model_copy(deep=True)
    s.trades.append(trade)
    s.balance      = round(s.balance + pnl_net, 2)
    s.daily_pnl    = round(s.daily_pnl + pnl_net, 2)
    s.daily_trades += 1

    if s.balance > s.peak_balance:
        s.peak_balance = s.balance
        if rules.get("trailing_dd", False):
            s.trailing_dd_floor = round(s.peak_balance * (1 - rules["max_drawdown_pct"] / 100), 2)

    if req.result == "loss":
        s.consecutive_losses += 1
    else:
        s.consecutive_losses = 0

    s.status = _check_outcome(s)

    consistency_warning = _check_consistency(s, rules)
    if consistency_warning:
        violations.append(consistency_warning)

    if rules.get("trailing_dd", False) and s.balance <= s.trailing_dd_floor:
        s.status = "blown"
        violations.append(
            f"Trailing drawdown breached — balance ${s.balance:.2f} hit floor ${s.trailing_dd_floor:.2f}"
        )

    drawdown_pct   = _effective_drawdown_pct(s, rules)
    profit_pct     = (s.balance - s.account_size) / s.account_size * 100
    daily_loss_pct = -s.daily_pnl / s.day_start_balance * 100 if s.daily_pnl < 0 else 0

    alerts = []
    if s.consecutive_losses >= 3:
        alerts.append(f"Warning: {s.consecutive_losses} consecutive losses — consider stepping back")
    if s.daily_trades >= 5:
        alerts.append(f"Heads up: {s.daily_trades} trades today — watch for overtrading")
    if rr < 1.0 and req.result != "breakeven":
        alerts.append(f"Low RR trade: {rr:.2f} — risking more than potential reward")

    return {
        "session":    s,
        "trade":      trade,
        "violations": violations,
        "alerts":     alerts,
        "metrics": {
            "drawdown_pct":           round(drawdown_pct, 3),
            "profit_pct":             round(profit_pct, 3),
            "daily_loss_pct":         round(daily_loss_pct, 3),
            "daily_loss_limit":       rules["daily_loss_limit_pct"],
            "max_drawdown_limit":     rules["max_drawdown_pct"],
            "profit_target":          rules["profit_target_pct"],
            "days_traded":            s.day,
            "min_trading_days":       rules["min_trading_days"],
            "profitable_days":        s.profitable_days,
            "count_profitable_days":  rules.get("count_profitable_days", False),
            "total_trades":           len(s.trades),
            "daily_trades":           s.daily_trades,
            "consecutive_losses":     s.consecutive_losses,
            "trailing_dd":            rules.get("trailing_dd", False),
            "trailing_dd_floor":      s.trailing_dd_floor,
            "payout_pct":             rules.get("payout_pct", 80),
            "win_rate":               round(sum(1 for t in s.trades if t.result=="win") / len(s.trades) * 100, 1) if s.trades else 0,
        },
    }


@router.post("/next-day")
async def next_day(req: NextDayRequest):
    if req.session.status != "active":
        raise HTTPException(status_code=400, detail="Session is no longer active")
    s = req.session.model_copy(deep=True)
    if s.daily_pnl > 0:
        s.profitable_days += 1
    s.day              += 1
    s.day_start_balance = s.balance
    s.daily_pnl         = 0.0
    s.daily_trades      = 0
    return {"session": s}


@router.post("/reset")
async def reset_simulation(req: ResetRequest):
    return {"session": None, "message": "Session cleared. Call /start to begin a new challenge."}


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE 1 — POST /pass-probability
# Trajectory-based pass probability model. Called after each trade from the
# frontend dashboard to show the live gauge.
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/pass-probability")
async def get_pass_probability(session: SimSession):
    """
    Returns a 0-100 pass probability with confidence band and per-factor scores.

    Model weights:
      profit_trajectory  30%
      drawdown_safety    25%
      daily_discipline   20%
      win_rate           15%
      days_compliance    10%
    """
    rules  = _rules(session)
    trades = session.trades
    total  = len(trades)

    profit_pct   = (session.balance - session.account_size) / session.account_size * 100
    drawdown_pct = _effective_drawdown_pct(session, rules)
    days_traded  = session.day
    min_days     = rules["min_trading_days"]
    target       = rules["profit_target_pct"]
    max_dd       = rules["max_drawdown_pct"]
    daily_limit  = rules["daily_loss_limit_pct"]

    # ── Factor 1: Profit trajectory ───────────────────────────────────────────
    EXPECTED_DAYS = max(min_days, 20)
    required_rate = target / EXPECTED_DAYS
    actual_rate   = profit_pct / max(days_traded, 1)
    traj_ratio    = actual_rate / required_rate if required_rate > 0 else 1.0

    if profit_pct >= target:
        profit_score = 100.0
    elif profit_pct >= target * 0.75:
        profit_score = 80 + (profit_pct - target * 0.75) / (target * 0.25) * 20
    elif traj_ratio >= 1.0:
        profit_score = 55 + min(traj_ratio - 1.0, 1.0) * 25
    elif traj_ratio >= 0.5:
        profit_score = 25 + (traj_ratio - 0.5) * 60
    else:
        profit_score = max(0.0, traj_ratio * 50)

    # ── Factor 2: Drawdown safety ─────────────────────────────────────────────
    dd_used_pct = drawdown_pct / max_dd * 100
    if dd_used_pct <= 20:
        dd_score = 100.0
    elif dd_used_pct <= 50:
        dd_score = 100 - (dd_used_pct - 20) * (40 / 30)
    elif dd_used_pct <= 80:
        dd_score = 60 - (dd_used_pct - 50) * (40 / 30)
    else:
        dd_score = max(0.0, 20 - (dd_used_pct - 80) * 2)

    # ── Factor 3: Daily discipline ────────────────────────────────────────────
    day_pnl: dict = {}
    for t in trades:
        day_pnl[t.day] = day_pnl.get(t.day, 0) + t.pnl

    close_calls = sum(
        1 for d, dpnl in day_pnl.items()
        if dpnl < 0 and abs(dpnl) / session.account_size * 100 > daily_limit * 0.6
    )
    discipline_score = max(0.0, 100 - close_calls * 20)

    # ── Factor 4: Win rate ────────────────────────────────────────────────────
    if total == 0:
        wr_score = 50.0
    else:
        wins     = sum(1 for t in trades if t.result == "win")
        wr       = wins / total
        wr_score = min(100.0, max(0.0, (wr - 0.3) / 0.4 * 100))

    # ── Factor 5: Min days compliance ─────────────────────────────────────────
    if min_days == 0:
        days_score = 100.0
    else:
        days_score = min(100.0, days_traded / min_days * 100)

    # ── Weighted composite ─────────────────────────────────────────────────────
    raw_score = (
        profit_score     * 0.30 +
        dd_score         * 0.25 +
        discipline_score * 0.20 +
        wr_score         * 0.15 +
        days_score       * 0.10
    )

    # Hard penalties
    if drawdown_pct >= max_dd * 0.9:
        raw_score *= 0.4
    if session.consecutive_losses >= 5:
        raw_score *= 0.8
    if profit_pct < 0:
        raw_score *= 0.85

    pass_prob = round(min(99.0, max(1.0, raw_score)), 1)

    # ── Confidence band ────────────────────────────────────────────────────────
    band_width = max(5.0, 20.0 - total * 0.5)
    low  = round(max(1.0,  pass_prob - band_width), 1)
    high = round(min(99.0, pass_prob + band_width), 1)

    # ── Status label ──────────────────────────────────────────────────────────
    if pass_prob >= 75:
        status  = "on_track"
        message = "On track — stay disciplined and protect your drawdown."
    elif pass_prob >= 50:
        status  = "caution"
        message = "Possible but needs improvement. Increase consistency and reduce risk."
    elif pass_prob >= 25:
        status  = "at_risk"
        message = "Challenge at risk. Reduce lot size and protect your drawdown now."
    else:
        status  = "critical"
        message = "Critical — current trajectory leads to failure. Step back and reassess."

    remaining_profit    = max(0.0, target - profit_pct)
    remaining_days_est  = max(1, EXPECTED_DAYS - days_traded)
    daily_needed        = round(remaining_profit / remaining_days_est, 3)

    return {
        "pass_probability":  pass_prob,
        "confidence_low":    low,
        "confidence_high":   high,
        "status":            status,
        "message":           message,
        "factors": {
            "profit_trajectory":  round(profit_score,     1),
            "drawdown_safety":    round(dd_score,         1),
            "daily_discipline":   round(discipline_score, 1),
            "win_rate":           round(wr_score,         1),
            "days_compliance":    round(days_score,       1),
        },
        "context": {
            "profit_pct":         round(profit_pct,  3),
            "target_pct":         target,
            "remaining_pct":      round(remaining_profit, 3),
            "daily_rate_needed":  daily_needed,
            "drawdown_pct":       round(drawdown_pct, 3),
            "dd_headroom_pct":    round(max_dd - drawdown_pct, 3),
            "days_traded":        days_traded,
            "min_days":           min_days,
            "total_trades":       total,
            "consecutive_losses": session.consecutive_losses,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /result  — full challenge report
# UPDATED: now includes equity_curve for the P&L chart (Feature 2)
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/result")
async def get_result(session: SimSession):
    rules      = _rules(session)
    trades     = session.trades
    wins       = [t for t in trades if t.result == "win"]
    losses     = [t for t in trades if t.result == "loss"]
    win_rate   = len(wins) / len(trades) * 100 if trades else 0
    avg_win    = sum(t.pnl for t in wins)  / len(wins)   if wins   else 0
    avg_loss   = abs(sum(t.pnl for t in losses) / len(losses)) if losses else 0
    expectancy = (win_rate/100 * avg_win) - ((1 - win_rate/100) * avg_loss)
    profit_pct = (session.balance - session.account_size) / session.account_size * 100
    drawdown   = _effective_drawdown_pct(session, rules)
    total_pnl  = session.balance - session.account_size
    total_comm = sum(t.commission for t in trades)

    day_pnl: dict = {}
    day_summary: dict = {}
    for t in trades:
        d = t.day
        day_pnl[d] = day_pnl.get(d, 0) + t.pnl
        if d not in day_summary:
            day_summary[d] = {"day": d, "trades": 0, "pnl": 0.0, "wins": 0, "losses": 0}
        day_summary[d]["trades"] += 1
        day_summary[d]["pnl"]    += t.pnl
        if t.result == "win":  day_summary[d]["wins"]   += 1
        if t.result == "loss": day_summary[d]["losses"] += 1

    max_day_pct = 0.0
    if total_pnl > 0:
        max_day_pct = max((v / total_pnl * 100 for v in day_pnl.values() if v > 0), default=0)

    consistency_ratio = rules.get("consistency_rule")
    consistency_met   = (consistency_ratio is None) or (max_day_pct <= consistency_ratio * 100)
    payout_pct        = rules.get("payout_pct", 80)
    payout_dollar     = round(max(total_pnl, 0) * payout_pct / 100, 2)

    news_violations    = 0  # flagged at trade time
    weekend_violations = sum(1 for t in trades if (t.days_held or 0) > 5 and not rules.get("allow_weekend_holding", True))
    pair_violations    = [t.symbol for t in trades if _check_pair_restriction(t.symbol, rules)]

    # ── FEATURE 2: Equity curve ───────────────────────────────────────────────
    # One data point per trade — balance, P&L%, drawdown%, result label
    equity_curve = []
    running      = session.account_size
    peak_running = session.account_size
    for t in trades:
        running      = round(running + t.pnl, 2)
        peak_running = max(peak_running, running)
        pnl_pct      = round((running - session.account_size) / session.account_size * 100, 3)
        dd_here      = round((peak_running - running) / peak_running * 100, 3) if peak_running > 0 else 0.0
        equity_curve.append({
            "trade":     len(equity_curve) + 1,
            "day":       t.day,
            "balance":   running,
            "pnl_pct":   pnl_pct,
            "result":    t.result,
            "symbol":    t.symbol,
            "drawdown":  dd_here,
        })

    # ── Max drawdown from equity curve ────────────────────────────────────────
    max_dd_intra = round(max((p["drawdown"] for p in equity_curve), default=0), 3)

    return {
        "status":              session.status,
        "firm":                rules["name"],
        "account_size":        session.account_size,
        "final_balance":       session.balance,
        "total_pnl":           round(total_pnl, 2),
        "total_commission":    round(total_comm, 2),
        "profit_pct":          round(profit_pct, 3),
        "drawdown_pct":        round(drawdown, 3),
        "max_intra_drawdown":  max_dd_intra,
        "days_traded":         session.day,
        "profitable_days":     session.profitable_days,
        "total_trades":        len(trades),
        "buy_trades":          sum(1 for t in trades if t.direction == "buy"),
        "sell_trades":         sum(1 for t in trades if t.direction == "sell"),
        "win_rate":            round(win_rate, 1),
        "avg_win":             round(avg_win, 2),
        "avg_loss":            round(avg_loss, 2),
        "expectancy":          round(expectancy, 2),
        "max_day_pct":         round(max_day_pct, 1),
        "profit_target_met":   profit_pct >= rules["profit_target_pct"],
        "drawdown_safe":       drawdown < rules["max_drawdown_pct"],
        "min_days_met":        _min_days_met(session, rules),
        "consistency_met":     consistency_met,
        "payout_pct":          payout_pct,
        "payout_dollar":       payout_dollar,
        "trailing_dd":         rules.get("trailing_dd", False),
        "trailing_dd_floor":   session.trailing_dd_floor,
        "news_violations":     news_violations,
        "weekend_violations":  weekend_violations,
        "pair_violations":     pair_violations,
        "days_breakdown":      sorted(day_summary.values(), key=lambda x: x["day"]),
        "equity_curve":        equity_curve,   # ← Feature 2
        "rules":               rules,
    }