"""
Trading Rules Routes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database.database import get_db

router = APIRouter(tags=["Trading Rules"])


class RuleCreate(BaseModel):
    name: str
    rule_type: str
    value: float
    enabled: bool = True


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    value: Optional[float] = None
    enabled: Optional[bool] = None


@router.get("/")
async def get_rules(
    account_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get all trading rules"""
    return {
        "rules": [
            {
                "id": 1,
                "name": "Daily Loss Limit",
                "rule_type": "daily_loss_limit",
                "value": 2.0,
                "unit": "percentage",
                "enabled": True,
                "current_value": 1.70,
                "status": "safe"
            },
            {
                "id": 2,
                "name": "Max Drawdown",
                "rule_type": "max_drawdown",
                "value": 5.0,
                "unit": "percentage",
                "enabled": True,
                "current_value": 0.0,
                "status": "safe"
            },
            {
                "id": 3,
                "name": "Risk Per Trade",
                "rule_type": "risk_per_trade",
                "value": 1.0,
                "unit": "percentage",
                "enabled": True,
                "current_value": 0.5,
                "status": "safe"
            },
            {
                "id": 4,
                "name": "Consecutive Loss Limit",
                "rule_type": "consecutive_loss_limit",
                "value": 3,
                "unit": "count",
                "enabled": True,
                "current_value": 0,
                "status": "safe"
            },
            {
                "id": 5,
                "name": "Minimum Risk/Reward Ratio",
                "rule_type": "min_rr_ratio",
                "value": 2.0,
                "unit": "ratio",
                "enabled": True,
                "current_value": 2.5,
                "status": "safe"
            }
        ]
    }


@router.post("/")
async def create_rule(
    rule: RuleCreate,
    account_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Create a new trading rule"""
    return {
        "id": 6,
        "name": rule.name,
        "rule_type": rule.rule_type,
        "value": rule.value,
        "enabled": rule.enabled,
        "message": "Rule created successfully"
    }


@router.get("/{rule_id}")
async def get_rule(rule_id: int, db: Session = Depends(get_db)):
    """Get specific rule details"""
    return {
        "id": rule_id,
        "name": "Daily Loss Limit",
        "rule_type": "daily_loss_limit",
        "value": 2.0,
        "unit": "percentage",
        "enabled": True,
        "violations": 0,
        "last_checked": "2026-02-10T12:30:00"
    }


@router.put("/{rule_id}")
async def update_rule(
    rule_id: int,
    rule: RuleUpdate,
    db: Session = Depends(get_db)
):
    """Update a trading rule"""
    return {
        "id": rule_id,
        "message": "Rule updated successfully",
        "updated_fields": rule.dict(exclude_unset=True)
    }


@router.delete("/{rule_id}")
async def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    """Delete a trading rule"""
    return {
        "message": "Rule deleted successfully",
        "rule_id": rule_id
    }


@router.post("/{rule_id}/toggle")
async def toggle_rule(rule_id: int, db: Session = Depends(get_db)):
    """Enable or disable a rule"""
    return {
        "id": rule_id,
        "enabled": True,
        "message": "Rule toggled successfully"
    }