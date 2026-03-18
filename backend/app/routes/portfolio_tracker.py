"""
portfolio_tracker.py — Portfolio Exposure & Margin Calculator
=============================================================
Tracks all open positions combined, calculates total risk exposure,
and computes margin requirements per position and account-wide.

Endpoints:
  POST /api/v1/portfolio/analyze    — analyze a list of open positions
  GET  /api/v1/portfolio/margin     — margin calculator (query params)
  POST /api/v1/portfolio/correlation — correlation risk between positions
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List
from collections import defaultdict
import math

from app.middleware.plan_gating import require_plan

router = APIRouter()

# ── Reference rates (static 2026 approximations, same as simulator) ───────────
REF_USDJPY    = 158.5
QUOTE_TO_USD  = {
    "GBP": 1.265, "EUR": 1.085, "AUD": 0.645, "NZD": 0.595,
    "CHF": 1.124, "CAD": 0.727, "SGD": 0.743, "NOK": 0.093,
    "SEK": 0.095, "DKK": 0.145, "HKD": 0.128, "ZAR": 0.055,
    "MXN": 0.058, "TRY": 0.032, "PLN": 0.249, "CZK": 0.044,
}

# ── Pip value calculation (same as simulator._calc_pnl) ──────────────────────
def _pip_value_usd(symbol: str, entry: float) -> tuple[float, float]:
    """Returns (pip_value_per_std_lot, pip_size)."""
    s = symbol.upper().replace(" ", "")

    if any(k in s for k in ["STEPINDEX","MULTISTEP"]):
        return 10.0, 1.0
    elif any(k in s for k in ["VOLATILITY","CRASH","BOOM","JUMP","RANGEBREAK"]):
        return 1.0, 1.0
    elif "XAUUSD" in s or s == "GOLD":
        return 1.0, 0.01
    elif "XAGUSD" in s or s == "SILVER":
        return 5.0, 0.001
    elif any(k in s for k in ["US30","US500","US100","SPX","NAS","DAX","UK100","GER40","FRA40","AUS200","JPN225"]):
        return 1.0, 1.0
    elif any(k in s for k in ["BTC","ETH","XRP","SOL","ADA","DOGE"]):
        return 1.0, 1.0
    else:
        q = s[-3:] if len(s) >= 6 else "USD"
        b = s[:3]  if len(s) >= 6 else "EUR"

        if q == "USD":
            return 10.0, 0.0001
        elif b == "USD" and q == "JPY":
            return 1000.0 / entry if entry > 0 else 1000.0 / REF_USDJPY, 0.01
        elif b == "USD":
            return (10.0 / entry if entry > 0 else 10.0), 0.0001
        elif q == "JPY":
            return 1000.0 / REF_USDJPY, 0.01
        else:
            conv = QUOTE_TO_USD.get(q, 1.0)
            return 10.0 * conv, 0.0001


def _margin_required(symbol: str, lots: float, entry: float, leverage: int = 100) -> float:
    """
    Calculate margin required for one position in USD.
    Formula: (lots * contract_size * entry_price) / leverage
    """
    s = symbol.upper().replace(" ", "")

    # Contract sizes
    if "XAUUSD" in s or s == "GOLD":
        contract_size = 100    # 100 troy oz
    elif "XAGUSD" in s or s == "SILVER":
        contract_size = 5000   # 5000 troy oz
    elif any(k in s for k in ["BTC","ETH","XRP","SOL","ADA","DOGE"]):
        contract_size = 1      # 1 unit of crypto
    elif any(k in s for k in ["US30","US500","US100","SPX","NAS","DAX"]):
        contract_size = 1      # 1 index unit
    elif any(k in s for k in ["VOLATILITY","CRASH","BOOM","JUMP","RANGEBREAK","STEPINDEX"]):
        contract_size = 1
    else:
        contract_size = 100_000  # standard forex lot

    # Margin in quote currency
    margin_quote = (lots * contract_size * entry) / leverage

    # Convert to USD
    q = s[-3:] if len(s) >= 6 else "USD"
    b = s[:3]  if len(s) >= 6 else "EUR"

    if q == "USD":
        return round(margin_quote, 2)
    elif q == "JPY":
        return round(margin_quote / REF_USDJPY, 2)
    elif q in QUOTE_TO_USD:
        return round(margin_quote * QUOTE_TO_USD[q], 2)
    else:
        return round(margin_quote, 2)  # fallback assume USD


# ── Currency correlation matrix (simplified, major pairs) ────────────────────
# Values: 1.0 = identical direction, -1.0 = perfectly opposite
CORRELATION_MAP = {
    frozenset(["EURUSD","GBPUSD"]): 0.85,
    frozenset(["EURUSD","AUDUSD"]): 0.70,
    frozenset(["EURUSD","NZDUSD"]): 0.65,
    frozenset(["EURUSD","USDCAD"]): -0.80,
    frozenset(["EURUSD","USDCHF"]): -0.92,
    frozenset(["EURUSD","USDJPY"]): -0.55,
    frozenset(["GBPUSD","AUDUSD"]): 0.68,
    frozenset(["GBPUSD","USDCAD"]): -0.75,
    frozenset(["GBPUSD","USDCHF"]): -0.88,
    frozenset(["AUDUSD","NZDUSD"]): 0.92,
    frozenset(["USDCAD","USDCHF"]): 0.70,
    frozenset(["USDJPY","USDCHF"]): 0.60,
    frozenset(["EURUSD","EURJPY"]): 0.75,
    frozenset(["GBPUSD","GBPJPY"]): 0.70,
    frozenset(["XAUUSD","EURUSD"]): 0.65,
    frozenset(["XAUUSD","USDJPY"]): -0.50,
}

def _get_correlation(sym1: str, sym2: str) -> float:
    key = frozenset([sym1.upper().replace("/",""), sym2.upper().replace("/","")])
    return CORRELATION_MAP.get(key, 0.0)

def _corr_risk_label(corr: float, both_same_direction: bool) -> str:
    """
    Label the risk of two positions given their correlation and direction.
    If both long and corr=0.9, that's HIGH amplification risk.
    If both long and corr=-0.9, that's high hedge (low net risk).
    """
    effective = corr if both_same_direction else -corr
    if effective >= 0.7:
        return "HIGH — amplified exposure"
    elif effective >= 0.4:
        return "MODERATE — partial overlap"
    elif effective >= -0.3:
        return "LOW — mostly independent"
    elif effective >= -0.6:
        return "HEDGE — partially offsetting"
    else:
        return "STRONG HEDGE — largely offsetting"


# ── Models ─────────────────────────────────────────────────────────────────────

class Position(BaseModel):
    symbol:        str
    direction:     str          # "buy" | "sell"
    lots:          float
    entry:         float
    sl:            Optional[float] = None
    tp:            Optional[float] = None
    current_price: Optional[float] = None   # for unrealised P&L

class PortfolioRequest(BaseModel):
    positions:      List[Position]
    account_balance: float
    leverage:       int = 100   # default 1:100


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/analyze")
async def analyze_portfolio(req: PortfolioRequest, _=Depends(require_plan("pro"))):
    """
    Analyze a portfolio of open positions.
    Returns: total risk $, margin used, currency exposure breakdown,
    correlation warnings, account % at risk.
    """
    if not req.positions:
        return {"error": "No positions provided"}

    balance   = req.account_balance
    leverage  = req.leverage
    positions = req.positions

    # ── Per-position metrics ──────────────────────────────────────────────────
    position_details = []
    total_risk_dollar = 0.0
    total_margin      = 0.0
    total_potential_reward = 0.0

    currency_net_lots: dict[str, float] = defaultdict(float)  # net USD exposure per currency

    for pos in positions:
        pv, ps       = _pip_value_usd(pos.symbol, pos.entry)
        sl_dist      = abs(pos.entry - pos.sl) if pos.sl else None
        tp_dist      = abs(pos.tp  - pos.entry) if pos.tp else None
        risk_dollar  = (sl_dist / ps) * pv * pos.lots if sl_dist else 0.0
        reward_dollar = (tp_dist / ps) * pv * pos.lots if tp_dist else 0.0
        margin       = _margin_required(pos.symbol, pos.lots, pos.entry, leverage)
        risk_pct     = round(risk_dollar / balance * 100, 4) if balance > 0 else 0

        # Unrealised P&L
        unrealised = 0.0
        if pos.current_price:
            price_diff  = pos.current_price - pos.entry
            if pos.direction.lower() == "sell":
                price_diff = -price_diff
            unrealised = (price_diff / ps) * pv * pos.lots

        total_risk_dollar       += risk_dollar
        total_margin            += margin
        total_potential_reward  += reward_dollar

        # Currency net exposure
        sym = pos.symbol.upper().replace("/", "")
        if len(sym) >= 6:
            base_ccy  = sym[:3]
            quote_ccy = sym[-3:]
            sign = 1 if pos.direction.lower() == "buy" else -1
            notional_usd = pos.lots * 100_000 * pos.entry
            currency_net_lots[base_ccy]  += sign * notional_usd
            currency_net_lots[quote_ccy] -= sign * notional_usd

        position_details.append({
            "symbol":        pos.symbol,
            "direction":     pos.direction.upper(),
            "lots":          pos.lots,
            "entry":         pos.entry,
            "sl":            pos.sl,
            "tp":            pos.tp,
            "pip_value":     round(pv, 4),
            "pip_size":      ps,
            "risk_dollar":   round(risk_dollar, 2),
            "reward_dollar": round(reward_dollar, 2),
            "rr":            round(reward_dollar / risk_dollar, 2) if risk_dollar > 0 else None,
            "risk_pct":      risk_pct,
            "margin_usd":    margin,
            "unrealised_pnl": round(unrealised, 2),
        })

    # ── Portfolio totals ──────────────────────────────────────────────────────
    total_risk_pct   = round(total_risk_dollar / balance * 100, 3) if balance > 0 else 0
    margin_level_pct = round((balance / total_margin * 100) if total_margin > 0 else 9999, 1)
    portfolio_rr     = round(total_potential_reward / total_risk_dollar, 2) if total_risk_dollar > 0 else None

    # Risk status
    if total_risk_pct >= 10:
        risk_status = "CRITICAL"
        risk_color  = "#ef4444"
    elif total_risk_pct >= 5:
        risk_status = "HIGH"
        risk_color  = "#f97316"
    elif total_risk_pct >= 3:
        risk_status = "MODERATE"
        risk_color  = "#f59e0b"
    else:
        risk_status = "SAFE"
        risk_color  = "#22c55e"

    # ── Correlation matrix ────────────────────────────────────────────────────
    correlation_warnings = []
    syms = [p.symbol.upper().replace("/","") for p in positions]
    dirs = [p.direction.lower() for p in positions]

    for i in range(len(positions)):
        for j in range(i+1, len(positions)):
            corr = _get_correlation(syms[i], syms[j])
            if abs(corr) >= 0.4:
                same_dir = dirs[i] == dirs[j]
                label    = _corr_risk_label(corr, same_dir)
                correlation_warnings.append({
                    "pair_a":      syms[i],
                    "pair_b":      syms[j],
                    "correlation": corr,
                    "dir_a":       dirs[i].upper(),
                    "dir_b":       dirs[j].upper(),
                    "risk_label":  label,
                    "note": f"{syms[i]} {dirs[i].upper()} + {syms[j]} {dirs[j].upper()} → {label}",
                })

    # ── Currency exposure (top 5) ─────────────────────────────────────────────
    currency_exposure = sorted(
        [{"currency": ccy, "net_usd": round(net, 0), "direction": "LONG" if net > 0 else "SHORT"}
         for ccy, net in currency_net_lots.items() if abs(net) > 100],
        key=lambda x: abs(x["net_usd"]),
        reverse=True
    )[:8]

    # ── Risk flags ────────────────────────────────────────────────────────────
    flags = []
    if total_risk_pct > 5:
        flags.append({"type": "danger", "msg": f"Total risk {total_risk_pct:.1f}% exceeds recommended 5% max"})
    if total_margin > balance * 0.5:
        flags.append({"type": "warning", "msg": f"Margin used ${total_margin:.0f} is over 50% of balance"})
    if margin_level_pct < 200:
        flags.append({"type": "danger", "msg": f"Margin level {margin_level_pct}% — margin call risk below 100%"})
    high_corr = [w for w in correlation_warnings if "HIGH" in w["risk_label"]]
    if high_corr:
        pairs = " + ".join([f"{w['pair_a']}/{w['pair_b']}" for w in high_corr[:2]])
        flags.append({"type": "warning", "msg": f"Highly correlated positions: {pairs}"})
    if len(positions) >= 5:
        flags.append({"type": "info", "msg": f"{len(positions)} open positions — monitor drawdown carefully"})

    return {
        "position_count":           len(positions),
        "account_balance":          balance,
        "leverage":                 leverage,

        "total_risk_dollar":        round(total_risk_dollar, 2),
        "total_risk_pct":           total_risk_pct,
        "risk_status":              risk_status,
        "risk_color":               risk_color,

        "total_margin_usd":         round(total_margin, 2),
        "margin_level_pct":         margin_level_pct,
        "free_margin":              round(balance - total_margin, 2),

        "total_potential_reward":   round(total_potential_reward, 2),
        "portfolio_rr":             portfolio_rr,

        "positions":                position_details,
        "correlation_warnings":     correlation_warnings,
        "currency_exposure":        currency_exposure,
        "flags":                    flags,
    }


@router.get("/margin")
async def calculate_margin(
    symbol:   str,
    lots:     float,
    entry:    float,
    leverage: int = 100,
    _=Depends(require_plan("pro")),
):
    """
    Simple margin calculator for a single position.
    GET /api/v1/portfolio/margin?symbol=EURUSD&lots=0.5&entry=1.085&leverage=100
    """
    pv, ps    = _pip_value_usd(symbol, entry)
    margin    = _margin_required(symbol, lots, entry, leverage)
    notional  = lots * 100_000 * entry  # approximate notional value

    return {
        "symbol":           symbol.upper(),
        "lots":             lots,
        "entry":            entry,
        "leverage":         f"1:{leverage}",
        "margin_required":  margin,
        "pip_value_usd":    round(pv, 4),
        "pip_size":         ps,
        "notional_usd":     round(notional, 2),
        "note": f"${margin:.2f} required to open {lots} lots of {symbol.upper()} at 1:{leverage} leverage",
    }


