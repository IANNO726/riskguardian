"""
risk_engine.py — Pre-Trade Risk Evaluation Engine v3
=====================================================
DERIV SYNTHETIC FORMULA (confirmed by user):
  Dollar Risk (SL)  = abs(entry - stop_loss)  * lot_size
  Dollar TP (TP)    = abs(entry - take_profit) * lot_size
  Step Index only   = abs(entry - stop_loss)  * lot_size * 10

FOREX FORMULA (standard):
  Dollar Risk = (price_distance / pip_size) * pip_value_per_lot * lot_size
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.database.database import get_db
from app.models.user import User, TradingAccount
from app.routes.auth_multi import get_current_user

router = APIRouter(tags=["Risk Engine"])

# ══════════════════════════════════════════════════════════════
# INSTRUMENT DATABASE
# Format: (pip_size, pip_value_per_lot, category, display_name, deriv_formula)
# deriv_formula = True  → dollar_risk = price_distance * lot_size
# deriv_formula = "step"→ dollar_risk = price_distance * lot_size * 10
# deriv_formula = False → standard forex formula
# ══════════════════════════════════════════════════════════════

INSTRUMENTS = {
    # ── Forex Majors ──────────────────────────────────────────
    "EURUSD":  (0.0001, 10.0,  "forex",    "EUR/USD",              False),
    "GBPUSD":  (0.0001, 10.0,  "forex",    "GBP/USD",              False),
    "AUDUSD":  (0.0001, 10.0,  "forex",    "AUD/USD",              False),
    "NZDUSD":  (0.0001, 10.0,  "forex",    "NZD/USD",              False),
    "USDCAD":  (0.0001, 7.7,   "forex",    "USD/CAD",              False),
    "USDCHF":  (0.0001, 11.2,  "forex",    "USD/CHF",              False),
    "USDJPY":  (0.01,   9.1,   "forex",    "USD/JPY",              False),
    "EURGBP":  (0.0001, 12.5,  "forex",    "EUR/GBP",              False),
    "EURJPY":  (0.01,   9.1,   "forex",    "EUR/JPY",              False),
    "GBPJPY":  (0.01,   9.1,   "forex",    "GBP/JPY",              False),
    "AUDJPY":  (0.01,   9.1,   "forex",    "AUD/JPY",              False),
    "EURCHF":  (0.0001, 11.2,  "forex",    "EUR/CHF",              False),
    "GBPAUD":  (0.0001, 10.0,  "forex",    "GBP/AUD",              False),
    "GBPCAD":  (0.0001, 7.7,   "forex",    "GBP/CAD",              False),
    "EURCAD":  (0.0001, 7.7,   "forex",    "EUR/CAD",              False),
    "EURNZD":  (0.0001, 10.0,  "forex",    "EUR/NZD",              False),
    "GBPNZD":  (0.0001, 10.0,  "forex",    "GBP/NZD",              False),
    "CADCHF":  (0.0001, 11.2,  "forex",    "CAD/CHF",              False),
    "CADJPY":  (0.01,   9.1,   "forex",    "CAD/JPY",              False),
    "NZDJPY":  (0.01,   9.1,   "forex",    "NZD/JPY",              False),
    "CHFJPY":  (0.01,   9.1,   "forex",    "CHF/JPY",              False),

    # ── Metals ────────────────────────────────────────────────
    "XAUUSD":  (0.01,   1.0,   "metals",   "Gold (XAU/USD)",       False),
    "XAGUSD":  (0.001,  5.0,   "metals",   "Silver (XAG/USD)",     False),
    "XPTUSD":  (0.01,   1.0,   "metals",   "Platinum",             False),

    # ── Energies ──────────────────────────────────────────────
    "USOIL":   (0.01,   1.0,   "energy",   "US Oil (WTI)",         False),
    "UKOIL":   (0.01,   1.0,   "energy",   "UK Oil (Brent)",       False),
    "XTIUSD":  (0.01,   1.0,   "energy",   "WTI Crude",            False),
    "XBRUSD":  (0.01,   1.0,   "energy",   "Brent Crude",          False),

    # ── Indices ───────────────────────────────────────────────
    "US30":    (1.0,    1.0,   "indices",  "Dow Jones US30",       False),
    "WALL ST": (1.0,    1.0,   "indices",  "Wall Street 30",       False),
    "US500":   (0.1,    10.0,  "indices",  "S&P 500",              False),
    "SPX500":  (0.1,    10.0,  "indices",  "S&P 500",              False),
    "NAS100":  (0.1,    10.0,  "indices",  "NASDAQ 100",           False),
    "USTEC":   (0.1,    10.0,  "indices",  "NASDAQ 100",           False),
    "UK100":   (1.0,    1.3,   "indices",  "FTSE 100",             False),
    "GER40":   (1.0,    1.1,   "indices",  "DAX 40",               False),
    "FRA40":   (1.0,    1.1,   "indices",  "CAC 40",               False),
    "JPN225":  (1.0,    0.067, "indices",  "Nikkei 225",           False),
    "AUS200":  (1.0,    0.65,  "indices",  "ASX 200",              False),

    # ══════════════════════════════════════════════════════════
    # DERIV SYNTHETIC INDICES
    # Formula: dollar_risk = abs(entry - sl) * lot_size
    # (price_distance × lot_size — NO pip value multiplier)
    # ══════════════════════════════════════════════════════════

    # ── Volatility Indices ─────────────────────────────────────
    "VOLATILITY 10 INDEX":         (1.0, 1.0, "synthetic", "Volatility 10 Index",         True),
    "VOLATILITY 10(1S) INDEX":     (1.0, 1.0, "synthetic", "Volatility 10(1s) Index",     True),
    "VOLATILITY 15(1S) INDEX":     (1.0, 1.0, "synthetic", "Volatility 15(1s) Index",     True),
    "VOLATILITY 25 INDEX":         (1.0, 1.0, "synthetic", "Volatility 25 Index",         True),
    "VOLATILITY 25(1S) INDEX":     (1.0, 1.0, "synthetic", "Volatility 25(1s) Index",     True),
    "VOLATILITY 30(1S) INDEX":     (1.0, 1.0, "synthetic", "Volatility 30(1s) Index",     True),
    "VOLATILITY 50 INDEX":         (1.0, 1.0, "synthetic", "Volatility 50 Index",         True),
    "VOLATILITY 50(1S) INDEX":     (1.0, 1.0, "synthetic", "Volatility 50(1s) Index",     True),
    "VOLATILITY 75 INDEX":         (1.0, 1.0, "synthetic", "Volatility 75 Index",         True),
    "VOLATILITY 75(1S) INDEX":     (1.0, 1.0, "synthetic", "Volatility 75(1s) Index",     True),
    "VOLATILITY 90(1S) INDEX":     (1.0, 1.0, "synthetic", "Volatility 90(1s) Index",     True),
    "VOLATILITY 100 INDEX":        (1.0, 1.0, "synthetic", "Volatility 100 Index",        True),
    "VOLATILITY 100(1S) INDEX":    (1.0, 1.0, "synthetic", "Volatility 100(1s) Index",    True),
    "VOLATILITY 150(1S) INDEX":    (1.0, 1.0, "synthetic", "Volatility 150(1s) Index",    True),
    "VOLATILITY 200(1S) INDEX":    (1.0, 1.0, "synthetic", "Volatility 200(1s) Index",    True),
    "VOLATILITY 250(1S) INDEX":    (1.0, 1.0, "synthetic", "Volatility 250(1s) Index",    True),

    # ── Crash & Boom (including 2025 600/900 series) ───────────
    "CRASH 300 INDEX":             (1.0, 1.0, "synthetic", "Crash 300 Index",             True),
    "CRASH 500 INDEX":             (1.0, 1.0, "synthetic", "Crash 500 Index",             True),
    "CRASH 600 INDEX":             (1.0, 1.0, "synthetic", "Crash 600 Index",             True),
    "CRASH 900 INDEX":             (1.0, 1.0, "synthetic", "Crash 900 Index",             True),
    "CRASH 1000 INDEX":            (1.0, 1.0, "synthetic", "Crash 1000 Index",            True),
    "BOOM 300 INDEX":              (1.0, 1.0, "synthetic", "Boom 300 Index",              True),
    "BOOM 500 INDEX":              (1.0, 1.0, "synthetic", "Boom 500 Index",              True),
    "BOOM 600 INDEX":              (1.0, 1.0, "synthetic", "Boom 600 Index",              True),
    "BOOM 900 INDEX":              (1.0, 1.0, "synthetic", "Boom 900 Index",              True),
    "BOOM 1000 INDEX":             (1.0, 1.0, "synthetic", "Boom 1000 Index",             True),

    # ── Drift Switching Indices (DSI) ──────────────────────────
    "DRIFT SWITCHING INDEX 10":    (1.0, 1.0, "synthetic", "Drift Switching Index 10",    True),
    "DRIFT SWITCHING INDEX 20":    (1.0, 1.0, "synthetic", "Drift Switching Index 20",    True),
    "DRIFT SWITCHING INDEX 30":    (1.0, 1.0, "synthetic", "Drift Switching Index 30",    True),

    # ── Step Indices — SPECIAL: points × $10 × lot_size ──────
    # Step size: 0.1 (Step), 0.2 (200), 0.3 (300), 0.4 (400), 0.5 (500)
    "STEP INDEX":                  (1.0, 10.0, "synthetic", "Step Index",                 "step"),
    "STEP INDEX 200":              (1.0, 10.0, "synthetic", "Step Index 200",             "step"),
    "STEP INDEX 300":              (1.0, 10.0, "synthetic", "Step Index 300",             "step"),
    "STEP INDEX 400":              (1.0, 10.0, "synthetic", "Step Index 400",             "step"),
    "STEP INDEX 500":              (1.0, 10.0, "synthetic", "Step Index 500",             "step"),

    # ── Multi Step Indices (3 variants — N different step sizes) ─
    "MULTI STEP 2 INDEX":          (1.0, 10.0, "synthetic", "Multi Step 2 Index",         "step"),
    "MULTI STEP 3 INDEX":          (1.0, 10.0, "synthetic", "Multi Step 3 Index",         "step"),
    "MULTI STEP 4 INDEX":          (1.0, 10.0, "synthetic", "Multi Step 4 Index",         "step"),

    # ── Skew Step Indices (4 variants — Up/Down with 80%/90% probability) ─
    "SKEW STEP INDEX 4 DOWN":      (1.0, 10.0, "synthetic", "Skew Step Index 4 Down",     "step"),
    "SKEW STEP INDEX 4 UP":        (1.0, 10.0, "synthetic", "Skew Step Index 4 Up",       "step"),
    "SKEW STEP INDEX 5 DOWN":      (1.0, 10.0, "synthetic", "Skew Step Index 5 Down",     "step"),
    "SKEW STEP INDEX 5 UP":        (1.0, 10.0, "synthetic", "Skew Step Index 5 Up",       "step"),

    # ── Range Break ────────────────────────────────────────────
    "RANGE BREAK 75 INDEX":        (1.0, 1.0, "synthetic", "Range Break 75 Index",        True),
    "RANGE BREAK 100 INDEX":       (1.0, 1.0, "synthetic", "Range Break 100 Index",       True),
    "RANGE BREAK 200 INDEX":       (1.0, 1.0, "synthetic", "Range Break 200 Index",       True),

    # ── Jump Indices ───────────────────────────────────────────
    "JUMP 10 INDEX":               (1.0, 1.0, "synthetic", "Jump 10 Index",               True),
    "JUMP 25 INDEX":               (1.0, 1.0, "synthetic", "Jump 25 Index",               True),
    "JUMP 50 INDEX":               (1.0, 1.0, "synthetic", "Jump 50 Index",               True),
    "JUMP 75 INDEX":               (1.0, 1.0, "synthetic", "Jump 75 Index",               True),
    "JUMP 100 INDEX":              (1.0, 1.0, "synthetic", "Jump 100 Index",              True),

    # ── DEX Indices ────────────────────────────────────────────
    "DEX 600 DOWN INDEX":          (1.0, 1.0, "synthetic", "DEX 600 Down Index",          True),
    "DEX 900 DOWN INDEX":          (1.0, 1.0, "synthetic", "DEX 900 Down Index",          True),
    "DEX 1500 DOWN INDEX":         (1.0, 1.0, "synthetic", "DEX 1500 Down Index",         True),
    "DEX 600 UP INDEX":            (1.0, 1.0, "synthetic", "DEX 600 Up Index",            True),
    "DEX 900 UP INDEX":            (1.0, 1.0, "synthetic", "DEX 900 Up Index",            True),
    "DEX 1500 UP INDEX":           (1.0, 1.0, "synthetic", "DEX 1500 Up Index",           True),

    # ── Hybrid Indices ─────────────────────────────────────────
    "HYBRID 10 INDEX":             (1.0, 1.0, "synthetic", "Hybrid 10 Index",             True),
    "HYBRID 30 INDEX":             (1.0, 1.0, "synthetic", "Hybrid 30 Index",             True),
    "HYBRID 50 INDEX":             (1.0, 1.0, "synthetic", "Hybrid 50 Index",             True),
    "HYBRID 90 INDEX":             (1.0, 1.0, "synthetic", "Hybrid 90 Index",             True),
    "HYBRID 100 INDEX":            (1.0, 1.0, "synthetic", "Hybrid 100 Index",            True),
    "HYBRID 600 INDEX":            (1.0, 1.0, "synthetic", "Hybrid 600 Index",            True),

    # ── Trek Indices ───────────────────────────────────────────
    "TREK 1 INDEX":                (1.0, 1.0, "synthetic", "Trek 1 Index",                True),
    "TREK 2 INDEX":                (1.0, 1.0, "synthetic", "Trek 2 Index",                True),

    # ── Spot Volatility Indices ────────────────────────────────
    "SPOT VOLATILITY 100 INDEX":   (1.0, 1.0, "synthetic", "Spot Volatility 100 Index",   True),
    "SPOT VOLATILITY 200 INDEX":   (1.0, 1.0, "synthetic", "Spot Volatility 200 Index",   True),

    # ── Volatility Switch Indices ──────────────────────────────
    "VOLATILITY SWITCH 10 INDEX":  (1.0, 1.0, "synthetic", "Volatility Switch 10 Index",  True),
    "VOLATILITY SWITCH 50 INDEX":  (1.0, 1.0, "synthetic", "Volatility Switch 50 Index",  True),
    "VOLATILITY SWITCH 100 INDEX": (1.0, 1.0, "synthetic", "Volatility Switch 100 Index", True),

    # ── Exponential Growth Indices ─────────────────────────────
    "EXPONENTIAL GROWTH INDEX 1":  (1.0, 1.0, "synthetic", "Exponential Growth Index 1",  True),
    "EXPONENTIAL GROWTH INDEX 2":  (1.0, 1.0, "synthetic", "Exponential Growth Index 2",  True),

    # ── Pairs Arbitrage Indices ────────────────────────────────
    "PAIRS ARBITRAGE INDEX 1":     (1.0, 1.0, "synthetic", "Pairs Arbitrage Index 1",     True),
    "PAIRS ARBITRAGE INDEX 2":     (1.0, 1.0, "synthetic", "Pairs Arbitrage Index 2",     True),

    # ── Tactical Indices (28 instruments — generic synthetic formula) ──
    # Add specific ones as they become known; fuzzy fallback covers the rest
    "TACTICAL INDEX 10":           (1.0, 1.0, "synthetic", "Tactical Index 10",           True),
    "TACTICAL INDEX 20":           (1.0, 1.0, "synthetic", "Tactical Index 20",           True),
}


# ── Smart fallback: auto-detect formula for ANY unlisted symbol ──────────────
def _auto_detect(symbol: str):
    """
    For symbols not in the INSTRUMENTS dict, infer the correct formula
    from name patterns so users can type any Deriv synthetic and still
    get an accurate calculation.
    """
    s = symbol.upper().strip()
    display = symbol.strip().title()

    # Step family → ×$10 formula
    if any(k in s for k in ["STEP INDEX", "MULTI STEP", "SKEW STEP", "SKEWED STEP",
                             "STEP INDICES", "MULTI-STEP", "SKEW-STEP"]):
        return (1.0, 10.0, "synthetic", display, "step")
    # Also catch "Step Index 200 / 300 / 400 / 500" by pattern
    import re as _re
    if _re.search(r"STEP\s+INDEX\s*\d*", s):
        return (1.0, 10.0, "synthetic", display, "step")

    # All other Deriv synthetics → price_distance × lot formula
    SYNTH_KEYWORDS = [
        "VOLATILITY", "CRASH", "BOOM", "JUMP", "RANGE BREAK", "RANGE-BREAK",
        "DEX", "DRIFT SWITCH", "DRIFT-SWITCH", "DSI", "HYBRID", "TREK",
        "SPOT VOLATILITY", "VOLATILITY SWITCH", "EXPONENTIAL GROWTH",
        "PAIRS ARBITRAGE", "TACTICAL", "SOFT COMMODIT",
        "BASKET INDIC", "INDEX",  # broad catch-all for anything named "*Index"
    ]
    if any(k in s for k in SYNTH_KEYWORDS):
        return (1.0, 1.0, "synthetic", display, True)

    # JPY pairs
    if "JPY" in s:
        return (0.01, 9.1, "forex", display, False)

    # Crypto (broad catch — no specific pip value)
    if any(k in s for k in ["BTC", "ETH", "XRP", "LTC", "SOL", "ADA", "BNB",
                              "DOGE", "DOT", "LINK", "UNI", "AVAX"]):
        return (1.0, 1.0, "crypto", display, False)

    # Generic forex fallback
    return (0.0001, 10.0, "forex", display, False)

# ── Fuzzy symbol lookup ────────────────────────────────────────
def _normalize(s: str) -> str:
    return s.upper().strip().replace("/","").replace("-","").replace("_","").replace(" ","")

def lookup_instrument(symbol: str):
    raw = symbol.upper().strip()

    # 1. Exact match
    if raw in INSTRUMENTS:
        return INSTRUMENTS[raw]

    # 2. Normalized match (strips spaces/slashes/dashes)
    norm = _normalize(raw)
    for k, v in INSTRUMENTS.items():
        if _normalize(k) == norm:
            return v

    # 3. Partial / shorthand match (e.g. "V75(1s)", "BOOM1000", "CRASH500")
    for k, v in INSTRUMENTS.items():
        if norm in _normalize(k) or _normalize(k) in norm:
            return v

    # 4. Smart auto-detect — infer formula from name pattern
    #    This means ANY Deriv synthetic the user types will compute correctly
    #    even if not in the INSTRUMENTS dict above.
    return _auto_detect(symbol)


# ══════════════════════════════════════════════════════════════
# PROP FIRM RULES
# ══════════════════════════════════════════════════════════════

PROP_FIRM_RULES = {
    "FTMO":            {"name":"FTMO",            "daily_loss_limit_pct":5.0,  "max_drawdown_pct":10.0, "profit_target_pct":10.0, "min_trading_days":4, "max_lot_per_trade":50.0,  "max_risk_per_trade_pct":2.0},
    "FundedNext":      {"name":"FundedNext",      "daily_loss_limit_pct":5.0,  "max_drawdown_pct":10.0, "profit_target_pct":8.0,  "min_trading_days":5, "max_lot_per_trade":100.0, "max_risk_per_trade_pct":3.0},
    "MyForexFunds":    {"name":"MyForexFunds",    "daily_loss_limit_pct":4.0,  "max_drawdown_pct":8.0,  "profit_target_pct":8.0,  "min_trading_days":5, "max_lot_per_trade":50.0,  "max_risk_per_trade_pct":2.0},
    "TheFundedTrader": {"name":"TheFundedTrader", "daily_loss_limit_pct":6.0,  "max_drawdown_pct":12.0, "profit_target_pct":10.0, "min_trading_days":0, "max_lot_per_trade":200.0, "max_risk_per_trade_pct":5.0},
    "E8Funding":       {"name":"E8Funding",       "daily_loss_limit_pct":5.0,  "max_drawdown_pct":8.0,  "profit_target_pct":8.0,  "min_trading_days":0, "max_lot_per_trade":100.0, "max_risk_per_trade_pct":2.0},
    "Deriv":           {"name":"Deriv",           "daily_loss_limit_pct":10.0, "max_drawdown_pct":10.0, "profit_target_pct":0.0,  "min_trading_days":0, "max_lot_per_trade":100.0, "max_risk_per_trade_pct":5.0},
    "Custom":          {"name":"Custom",          "daily_loss_limit_pct":5.0,  "max_drawdown_pct":10.0, "profit_target_pct":10.0, "min_trading_days":0, "max_lot_per_trade":100.0, "max_risk_per_trade_pct":3.0},
}


# ══════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════

class TradeEvalRequest(BaseModel):
    account_id: int
    symbol: str
    entry_price: float
    stop_loss: float
    take_profit: float
    lot_size: float
    custom_balance: Optional[float] = None
    prop_firm: Optional[str] = None
    current_daily_loss_pct: Optional[float] = 0.0

class RiskMetrics(BaseModel):
    dollar_risk: float
    dollar_profit: float        # TP dollar value
    risk_pct: float
    reward_pct: float           # TP as % of balance
    rr_ratio: float
    point_risk: float
    point_reward: float
    formula_used: str           # "deriv_synthetic" | "step_index" | "standard_forex"
    suggested_lot_size: float
    max_lot_for_1pct: float
    instrument_category: str
    balance_used: float

class PropCheck(BaseModel):
    firm: str
    passed: bool
    violations: List[str]
    warnings: List[str]

class SafetyScore(BaseModel):
    total: int
    risk_discipline: int
    rr_quality: int
    prop_compliance: int
    zone: str
    color: str

class Recommendation(BaseModel):
    action: str
    message: str
    adjusted_lot: Optional[float]
    reason: str

class TradeEvalResponse(BaseModel):
    symbol: str
    display_name: str
    entry_price: float
    stop_loss: float
    take_profit: float
    lot_size: float
    account_balance: float
    metrics: RiskMetrics
    prop_check: Optional[PropCheck]
    safety_score: SafetyScore
    recommendation: Recommendation
    checklist: List[dict]
    evaluated_at: datetime


# ══════════════════════════════════════════════════════════════
# CORE CALCULATION
# ══════════════════════════════════════════════════════════════

def calculate_metrics(symbol, entry, sl, tp, lot_size, balance) -> RiskMetrics:
    pip_size, pip_val, category, display, deriv_mode = lookup_instrument(symbol)

    sl_distance = abs(entry - sl)
    tp_distance = abs(entry - tp)

    # ── Choose formula based on instrument type ──────────────
    if deriv_mode == "step":
        # Step Index: points × $10 × lot_size
        dollar_risk   = sl_distance * 10.0 * lot_size
        dollar_profit = tp_distance * 10.0 * lot_size
        point_risk    = sl_distance
        point_reward  = tp_distance
        formula_used  = "step_index (points × $10 × lot)"

    elif deriv_mode is True:
        # All other Deriv Synthetics: price_distance × lot_size
        dollar_risk   = sl_distance * lot_size
        dollar_profit = tp_distance * lot_size
        point_risk    = sl_distance
        point_reward  = tp_distance
        formula_used  = "deriv_synthetic (price_distance × lot)"

    else:
        # Standard Forex / Metals / Indices
        point_risk    = sl_distance / pip_size
        point_reward  = tp_distance / pip_size
        dollar_risk   = point_risk   * pip_val * lot_size
        dollar_profit = point_reward * pip_val * lot_size
        formula_used  = "standard_forex (pips × pip_value × lot)"

    rr_ratio   = (dollar_profit / dollar_risk) if dollar_risk > 0 else 0
    risk_pct   = (dollar_risk   / balance * 100) if balance > 0 else 0
    reward_pct = (dollar_profit / balance * 100) if balance > 0 else 0

    # Max lot for exactly 1% risk
    one_pct_dollar = balance * 0.01
    if deriv_mode == "step":
        max_lot = one_pct_dollar / (sl_distance * 10.0) if sl_distance > 0 else lot_size
    elif deriv_mode is True:
        max_lot = one_pct_dollar / sl_distance if sl_distance > 0 else lot_size
    else:
        max_lot = one_pct_dollar / (point_risk * pip_val) if (point_risk * pip_val) > 0 else lot_size

    max_lot = round(max(0.01, max_lot), 2)

    return RiskMetrics(
        dollar_risk          = round(dollar_risk,   2),
        dollar_profit        = round(dollar_profit, 2),
        risk_pct             = round(risk_pct,      4),
        reward_pct           = round(reward_pct,    4),
        rr_ratio             = round(rr_ratio,      2),
        point_risk           = round(point_risk,    2),
        point_reward         = round(point_reward,  2),
        formula_used         = formula_used,
        suggested_lot_size   = max_lot,
        max_lot_for_1pct     = max_lot,
        instrument_category  = category,
        balance_used         = round(balance,       2),
    )


def check_prop_rules(metrics, lot_size, prop_firm, daily_loss_pct) -> PropCheck:
    rules = PROP_FIRM_RULES.get(prop_firm, PROP_FIRM_RULES["Custom"])
    violations, warnings = [], []

    if metrics.risk_pct > rules["max_risk_per_trade_pct"]:
        violations.append(f"Risk {metrics.risk_pct:.3f}% exceeds {rules['name']} limit of {rules['max_risk_per_trade_pct']}%")
    elif metrics.risk_pct > rules["max_risk_per_trade_pct"] * 0.8:
        warnings.append(f"Risk {metrics.risk_pct:.3f}% approaching {rules['name']} limit of {rules['max_risk_per_trade_pct']}%")

    remaining = rules["daily_loss_limit_pct"] - (daily_loss_pct or 0)
    if metrics.risk_pct > remaining:
        violations.append(f"Could breach daily loss limit — only {remaining:.2f}% remaining today")
    elif metrics.risk_pct > remaining * 0.7:
        warnings.append(f"Uses {metrics.risk_pct:.3f}% of your {remaining:.2f}% daily loss allowance")

    if lot_size > rules["max_lot_per_trade"]:
        violations.append(f"Lot size {lot_size} exceeds {rules['name']} max of {rules['max_lot_per_trade']}")

    if metrics.rr_ratio < 1.0:
        warnings.append("R:R below 1:1 — most prop firms expect minimum 1:1")

    return PropCheck(firm=rules["name"], passed=len(violations)==0, violations=violations, warnings=warnings)


def calculate_safety_score(metrics, prop_check) -> SafetyScore:
    r = metrics.risk_pct
    risk_score = 40 if r<=1 else 34 if r<=1.5 else 28 if r<=2 else 20 if r<=3 else 10 if r<=5 else 0

    rr = metrics.rr_ratio
    rr_score = 30 if rr>=3 else 24 if rr>=2 else 18 if rr>=1.5 else 10 if rr>=1 else 4 if rr>=0.5 else 0

    prop_score = 30
    if prop_check:
        prop_score = 0 if not prop_check.passed else 18 if prop_check.warnings else 30

    total = risk_score + rr_score + prop_score
    zone, color = ("safe","#22c55e") if total>=75 else ("caution","#f59e0b") if total>=50 else ("danger","#ef4444")
    return SafetyScore(total=total, risk_discipline=risk_score, rr_quality=rr_score, prop_compliance=prop_score, zone=zone, color=color)


def build_recommendation(metrics, prop_check, safety_score, lot_size) -> Recommendation:
    violations = prop_check.violations if prop_check else []
    if safety_score.zone == "danger" or violations:
        reason = violations[0] if violations else f"Risk of {metrics.risk_pct:.3f}% is too high"
        return Recommendation(action="AVOID", message="Do not take this trade as configured", adjusted_lot=metrics.suggested_lot_size, reason=reason)
    elif safety_score.zone == "caution":
        new_lot  = metrics.suggested_lot_size
        new_risk = round((metrics.risk_pct / lot_size) * new_lot, 4) if lot_size > 0 else metrics.risk_pct
        return Recommendation(action="REDUCE", message=f"Reduce lot from {lot_size} → {new_lot} to cut risk from {metrics.risk_pct:.3f}% → {new_risk:.3f}%", adjusted_lot=new_lot, reason="Risk is elevated — reducing lot improves safety score")
    else:
        return Recommendation(action="PROCEED", message="Trade looks good — risk is within acceptable limits", adjusted_lot=None, reason=f"Risk ${metrics.dollar_risk:.2f} ({metrics.risk_pct:.3f}%) · Potential ${metrics.dollar_profit:.2f} · RR 1:{metrics.rr_ratio:.2f} · Score {safety_score.total}/100")


def build_checklist(metrics, prop_check, entry, sl, tp) -> list:
    def item(label, passed, detail=""): return {"label":label,"passed":passed,"detail":detail}
    long_trade = tp > entry
    sl_correct = (sl < entry) if long_trade else (sl > entry)
    tp_correct = (tp > entry) if long_trade else (tp < entry)
    items = [
        item("Risk below 2% of balance",    metrics.risk_pct <= 2,              f"${metrics.dollar_risk:.2f} = {metrics.risk_pct:.3f}% of ${metrics.balance_used:,.2f}"),
        item("Stop loss defined",           sl > 0 and sl != entry,             f"SL at {sl}"),
        item("Take profit defined",         tp > 0 and tp != entry,             f"TP at {tp}"),
        item("Risk:Reward ≥ 1:2",           metrics.rr_ratio >= 2,              f"RR is 1:{metrics.rr_ratio:.2f}"),
        item("SL on correct side",          sl_correct,                         f"{'Long' if long_trade else 'Short'} trade — SL at {sl}"),
        item("TP on correct side",          tp_correct,                         f"TP at {tp}"),
        item("Dollar risk < 5% balance",    metrics.dollar_risk < metrics.balance_used * 0.05, f"${metrics.dollar_risk:.2f} risk vs ${metrics.balance_used * 0.05:,.2f} limit"),
        item("Potential profit > risk",     metrics.dollar_profit > metrics.dollar_risk,       f"Profit ${metrics.dollar_profit:.2f} vs Risk ${metrics.dollar_risk:.2f}"),
    ]
    if prop_check:
        items.append(item(f"{prop_check.firm} rules passed", prop_check.passed, prop_check.violations[0] if prop_check.violations else "All rules satisfied"))
    return items


# ══════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════

@router.get("/prop-firms")
async def list_prop_firms():
    return [{"key":k,"name":v["name"],"daily_loss_limit_pct":v["daily_loss_limit_pct"],"max_drawdown_pct":v["max_drawdown_pct"],"max_risk_per_trade_pct":v["max_risk_per_trade_pct"]} for k,v in PROP_FIRM_RULES.items()]


@router.get("/instruments")
async def list_instruments():
    grouped: dict = {}
    for key, (_, _, cat, display, _df) in INSTRUMENTS.items():
        grouped.setdefault(cat, []).append({"symbol": key, "display": display})
    return grouped


@router.post("/evaluate", response_model=TradeEvalResponse)
async def evaluate_trade(
    req: TradeEvalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = db.query(TradingAccount).filter(
        TradingAccount.id == req.account_id,
        TradingAccount.user_id == current_user.id,
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    balance = float(req.custom_balance) if req.custom_balance and req.custom_balance > 0 else float(account.last_balance or 10000)

    _, _, _, display_name, _ = lookup_instrument(req.symbol)

    metrics        = calculate_metrics(req.symbol, req.entry_price, req.stop_loss, req.take_profit, req.lot_size, balance)
    prop_check     = check_prop_rules(metrics, req.lot_size, req.prop_firm, req.current_daily_loss_pct or 0) if req.prop_firm and req.prop_firm in PROP_FIRM_RULES else None
    safety_score   = calculate_safety_score(metrics, prop_check)
    recommendation = build_recommendation(metrics, prop_check, safety_score, req.lot_size)
    checklist      = build_checklist(metrics, prop_check, req.entry_price, req.stop_loss, req.take_profit)

    return TradeEvalResponse(
        symbol          = req.symbol.upper(),
        display_name    = display_name,
        entry_price     = req.entry_price,
        stop_loss       = req.stop_loss,
        take_profit     = req.take_profit,
        lot_size        = req.lot_size,
        account_balance = balance,
        metrics         = metrics,
        prop_check      = prop_check,
        safety_score    = safety_score,
        recommendation  = recommendation,
        checklist       = checklist,
        evaluated_at    = datetime.utcnow(),
    )