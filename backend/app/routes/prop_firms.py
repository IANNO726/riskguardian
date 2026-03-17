from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from app.database.database import Base, get_db
from app.routes.auth_multi import get_current_user
from app.models.user import User
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

router = APIRouter()

# ── Built-in firm profiles ────────────────────────────────────
PROP_FIRM_PRESETS = {
    "ftmo_10k": {
        "name": "FTMO $10K Challenge",
        "firm": "FTMO",
        "account_size": 10000,
        "daily_loss_limit": 5.0,
        "max_drawdown": 10.0,
        "profit_target": 10.0,
        "min_trading_days": 10,
        "max_positions": 0,
        "color": "#f59e0b",
        "logo": "🏆"
    },
    "ftmo_25k": {
        "name": "FTMO $25K Challenge",
        "firm": "FTMO",
        "account_size": 25000,
        "daily_loss_limit": 5.0,
        "max_drawdown": 10.0,
        "profit_target": 10.0,
        "min_trading_days": 10,
        "max_positions": 0,
        "color": "#f59e0b",
        "logo": "🏆"
    },
    "ftmo_100k": {
        "name": "FTMO $100K Challenge",
        "firm": "FTMO",
        "account_size": 100000,
        "daily_loss_limit": 5.0,
        "max_drawdown": 10.0,
        "profit_target": 10.0,
        "min_trading_days": 10,
        "max_positions": 0,
        "color": "#f59e0b",
        "logo": "🏆"
    },
    "mff_10k": {
        "name": "MyForexFunds $10K",
        "firm": "MyForexFunds",
        "account_size": 10000,
        "daily_loss_limit": 5.0,
        "max_drawdown": 12.0,
        "profit_target": 8.0,
        "min_trading_days": 5,
        "max_positions": 0,
        "color": "#22c55e",
        "logo": "💰"
    },
    "e8_25k": {
        "name": "E8 Funding $25K",
        "firm": "E8 Funding",
        "account_size": 25000,
        "daily_loss_limit": 5.0,
        "max_drawdown": 8.0,
        "profit_target": 8.0,
        "min_trading_days": 0,
        "max_positions": 0,
        "color": "#a855f7",
        "logo": "⚡"
    },
    "topstep_50k": {
        "name": "TopstepFX $50K",
        "firm": "TopstepFX",
        "account_size": 50000,
        "daily_loss_limit": 2.0,
        "max_drawdown": 6.0,
        "profit_target": 6.0,
        "min_trading_days": 0,
        "max_positions": 0,
        "color": "#38bdf8",
        "logo": "📈"
    },
    "funded_next_15k": {
        "name": "FundedNext $15K",
        "firm": "FundedNext",
        "account_size": 15000,
        "daily_loss_limit": 5.0,
        "max_drawdown": 10.0,
        "profit_target": 10.0,
        "min_trading_days": 5,
        "max_positions": 0,
        "color": "#ec4899",
        "logo": "🚀"
    },
    "the5ers_20k": {
        "name": "The5ers $20K Hyper",
        "firm": "The5ers",
        "account_size": 20000,
        "daily_loss_limit": 4.0,
        "max_drawdown": 8.0,
        "profit_target": 10.0,
        "min_trading_days": 0,
        "max_positions": 0,
        "color": "#ef4444",
        "logo": "5️⃣"
    },
}

# ── Model ────────────────────────────────────────────────────
class ActivePropProfile(Base):
    __tablename__ = "active_prop_profiles"
    id           = Column(Integer, primary_key=True)
    user_id      = Column(Integer, ForeignKey("users.id"))
    preset_key   = Column(String)
    firm_name    = Column(String)
    account_size = Column(Float)
    daily_loss_limit = Column(Float)
    max_drawdown = Column(Float)
    profit_target = Column(Float)
    is_active    = Column(Boolean, default=True)
    activated_at = Column(DateTime, default=datetime.utcnow)
    start_balance = Column(Float, default=0.0)
    notes        = Column(String, default="")

# ── Routes ───────────────────────────────────────────────────
@router.get("/presets")
async def get_presets():
    return {"presets": PROP_FIRM_PRESETS}

@router.get("/active")
async def get_active_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(ActivePropProfile).filter(
        ActivePropProfile.user_id == current_user.id,
        ActivePropProfile.is_active == True
    ).first()

    if not profile:
        return {"active": False, "profile": None}

    preset = PROP_FIRM_PRESETS.get(profile.preset_key, {})
    return {
        "active": True,
        "profile": {
            "id": profile.id,
            "preset_key": profile.preset_key,
            "firm_name": profile.firm_name,
            "account_size": profile.account_size,
            "daily_loss_limit": profile.daily_loss_limit,
            "max_drawdown": profile.max_drawdown,
            "profit_target": profile.profit_target,
            "activated_at": profile.activated_at.isoformat(),
            "color": preset.get("color", "#38bdf8"),
            "logo": preset.get("logo", "🏢"),
        }
    }

@router.post("/activate/{preset_key}")
async def activate_profile(
    preset_key: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    preset = PROP_FIRM_PRESETS.get(preset_key)
    if not preset:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Preset not found")

    # Deactivate existing
    db.query(ActivePropProfile).filter(
        ActivePropProfile.user_id == current_user.id
    ).update({"is_active": False})

    profile = ActivePropProfile(
        user_id=current_user.id,
        preset_key=preset_key,
        firm_name=preset["firm"],
        account_size=preset["account_size"],
        daily_loss_limit=preset["daily_loss_limit"],
        max_drawdown=preset["max_drawdown"],
        profit_target=preset["profit_target"],
        is_active=True
    )
    db.add(profile)
    db.commit()

    return {"success": True, "message": f"✅ {preset['name']} activated!", "profile": preset}

@router.post("/deactivate")
async def deactivate_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(ActivePropProfile).filter(
        ActivePropProfile.user_id == current_user.id
    ).update({"is_active": False})
    db.commit()
    return {"success": True, "message": "Prop firm profile deactivated"}
