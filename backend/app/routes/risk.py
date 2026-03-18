"""
Risk Monitoring Routes
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional

from app.database.database import get_db

# ✅ NEW IMPORT
from app.services.rule_engine import RuleEngine

router = APIRouter(tags=["Risk Management"])


# =====================================================
# 📊 DASHBOARD (UNCHANGED)
# =====================================================
@router.get("/dashboard")
async def get_risk_dashboard(
    account_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get risk management dashboard data"""
    return {
        "account_balance": 10000.00,
        "current_equity": 10170.00,
        "daily_pnl": 170.00,
        "daily_pnl_percentage": 1.70,
        "max_drawdown": 2.5,
        "current_drawdown": 0.0,
        "risk_score": 35,
        "risk_level": "Low",
        "active_positions": 2,
        "total_exposure": 1500.00,
        "margin_used": 300.00,
        "margin_available": 9700.00,
        "margin_level": 3390.00,
        "rules_status": {
            "daily_loss_limit": {"status": "safe", "current": 1.70, "limit": 2.00},
            "max_drawdown": {"status": "safe", "current": 0.0, "limit": 5.00},
            "consecutive_losses": {"status": "safe", "current": 0, "limit": 3}
        }
    }


# =====================================================
# 📈 EXPOSURE (UNCHANGED)
# =====================================================
@router.get("/exposure")
async def get_exposure(
    account_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get current market exposure"""
    return {
        "total_exposure": 1500.00,
        "by_symbol": {
            "EURUSD": 800.00,
            "GBPUSD": 700.00
        },
        "by_direction": {
            "long": 800.00,
            "short": 700.00
        }
    }


# =====================================================
# 📉 DRAWDOWN HISTORY (UNCHANGED)
# =====================================================
@router.get("/drawdown")
async def get_drawdown_history(
    account_id: Optional[int] = None,
    period: str = "week",
    db: Session = Depends(get_db)
):
    """Get drawdown history"""
    return {
        "current_drawdown": 0.0,
        "max_drawdown": 2.5,
        "peak_balance": 10250.00,
        "history": [
            {"date": "2026-02-10", "drawdown": 0.0},
            {"date": "2026-02-09", "drawdown": 1.2},
            {"date": "2026-02-08", "drawdown": 2.5}
        ]
    }


# =====================================================
# 🧠 NEW RULE VALIDATION ENDPOINT
# =====================================================
@router.post("/validate-account/{user_id}")
async def validate_account_rules(
    user_id: int,
    account_data: dict,
    db: Session = Depends(get_db)
):
    """
    Validate account against stored risk rules.
    """

    engine = RuleEngine(db)
    violations = engine.validate_account(user_id, account_data)

    return {
        "status": "ok" if not violations else "violated",
        "violations": violations
    }


# =====================================================
# 🧠 NEW TRADE VALIDATION ENDPOINT
# =====================================================
@router.post("/validate-trade/{user_id}")
async def validate_trade_rules(
    user_id: int,
    trade_data: dict,
    db: Session = Depends(get_db)
):
    """
    Validate single trade before execution.
    """

    engine = RuleEngine(db)
    violations = engine.validate_trade(user_id, trade_data)

    return {
        "status": "ok" if not violations else "violated",
        "violations": violations
    }


