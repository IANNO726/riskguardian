"""
Risk Rule Engine — Backend
Stores custom IF/THEN rules and evaluates them against live account data.
Integrates with cooldown system to auto-trigger blocks.

Routes:
  GET    /api/v1/risk-rules/              → list all rules
  POST   /api/v1/risk-rules/              → create rule
  PUT    /api/v1/risk-rules/{id}          → update rule
  DELETE /api/v1/risk-rules/{id}          → delete rule
  POST   /api/v1/risk-rules/{id}/toggle   → enable/disable
  POST   /api/v1/risk-rules/evaluate      → evaluate all rules NOW
  GET    /api/v1/risk-rules/status        → current block status + triggered rules
  GET    /api/v1/risk-rules/history       → trigger history log
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, ForeignKey, Text
from app.database.database import Base, get_db
from app.routes.auth_multi import get_current_user
from app.models.user import User
from app.routes.cooldown import CooldownSession
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# ═══════════════════════════════════════════════════════════
# DATABASE MODELS
# ═══════════════════════════════════════════════════════════

class RiskRule(Base):
    __tablename__ = "enterprise_risk_rules"
    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=False)
    name            = Column(String, nullable=False)
    condition_type  = Column(String, nullable=False)   # See CONDITION_TYPES below
    condition_value = Column(Float, nullable=False)    # Threshold value
    action_type     = Column(String, nullable=False)   # See ACTION_TYPES below
    action_value    = Column(Float, default=0)         # e.g. cooldown minutes
    is_active       = Column(Boolean, default=True)
    trigger_count   = Column(Integer, default=0)
    last_triggered  = Column(DateTime, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    notes           = Column(Text, default="")

class RuleTriggerLog(Base):
    __tablename__ = "enterprise_rule_logs"
    id              = Column(Integer, primary_key=True, index=True)
    rule_id         = Column(Integer, ForeignKey("enterprise_risk_rules.id"))
    user_id         = Column(Integer, ForeignKey("users.id"))
    triggered_at    = Column(DateTime, default=datetime.utcnow)
    condition_type  = Column(String)
    condition_value = Column(Float)
    actual_value    = Column(Float)   # What the actual metric was when triggered
    action_type     = Column(String)
    action_value    = Column(Float)
    rule_name       = Column(String)

class TradeBlock(Base):
    __tablename__ = "enterprise_trade_blocks"
    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"), unique=True)
    is_blocked      = Column(Boolean, default=False)
    reason          = Column(String, default="")
    rule_name       = Column(String, default="")
    blocked_at      = Column(DateTime, nullable=True)
    unblocks_at     = Column(DateTime, nullable=True)   # None = manual unblock only

# ═══════════════════════════════════════════════════════════
# CONDITION & ACTION DEFINITIONS
# ═══════════════════════════════════════════════════════════

# condition_type → how to read condition_value
CONDITION_TYPES = {
    "loss_per_trade_pct":      "Loss on single trade exceeds X% of balance",
    "consecutive_losses":      "Consecutive losing trades >= X",
    "daily_drawdown_pct":      "Daily drawdown exceeds X% of balance",
    "daily_loss_usd":          "Daily loss exceeds $X",
    "open_positions":          "Open positions count > X",
    "equity_below_usd":        "Equity drops below $X",
    "equity_drawdown_pct":     "Equity drawdown from peak exceeds X%",
    "win_rate_below_pct":      "Win rate (last 20 trades) drops below X%",
    "profit_target_hit_pct":   "Profit target of X% reached (lock gains)",
}

# action_type → what happens when condition met
ACTION_TYPES = {
    "block_new_trades":        "Block all new trades",
    "start_cooldown":          "Start cooldown for X minutes",
    "send_alert":              "Send alert notification",
    "reduce_risk":             "Flag to reduce lot size by X%",
}

# ═══════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════

class RuleCreate(BaseModel):
    name:            str
    condition_type:  str
    condition_value: float
    action_type:     str
    action_value:    float = 0
    notes:           str = ""

class RuleUpdate(BaseModel):
    name:            Optional[str] = None
    condition_type:  Optional[str] = None
    condition_value: Optional[float] = None
    action_type:     Optional[str] = None
    action_value:    Optional[float] = None
    notes:           Optional[str] = None
    is_active:       Optional[bool] = None

class AccountSnapshot(BaseModel):
    """Current account metrics passed from frontend for evaluation"""
    balance:              float = 0
    equity:               float = 0
    daily_pnl:            float = 0          # negative = loss
    open_positions:       int   = 0
    consecutive_losses:   int   = 0
    last_trade_pnl:       float = 0
    peak_equity:          float = 0          # for drawdown calc
    win_rate_last20:      float = 0          # 0-100

# ═══════════════════════════════════════════════════════════
# RULE EVALUATOR
# ═══════════════════════════════════════════════════════════

def evaluate_condition(rule: RiskRule, snap: AccountSnapshot) -> tuple[bool, float]:
    """
    Returns (triggered: bool, actual_value: float)
    """
    ct  = rule.condition_type
    cv  = rule.condition_value
    bal = snap.balance if snap.balance > 0 else 1  # avoid /0

    if ct == "loss_per_trade_pct":
        actual = abs(snap.last_trade_pnl) / bal * 100 if snap.last_trade_pnl < 0 else 0
        return actual >= cv, actual

    elif ct == "consecutive_losses":
        return snap.consecutive_losses >= cv, float(snap.consecutive_losses)

    elif ct == "daily_drawdown_pct":
        actual = abs(snap.daily_pnl) / bal * 100 if snap.daily_pnl < 0 else 0
        return actual >= cv, actual

    elif ct == "daily_loss_usd":
        actual = abs(snap.daily_pnl) if snap.daily_pnl < 0 else 0
        return actual >= cv, actual

    elif ct == "open_positions":
        return snap.open_positions > cv, float(snap.open_positions)

    elif ct == "equity_below_usd":
        return snap.equity <= cv, snap.equity

    elif ct == "equity_drawdown_pct":
        peak = snap.peak_equity if snap.peak_equity > 0 else snap.equity
        actual = (peak - snap.equity) / peak * 100 if peak > snap.equity else 0
        return actual >= cv, actual

    elif ct == "win_rate_below_pct":
        return snap.win_rate_last20 < cv, snap.win_rate_last20

    elif ct == "profit_target_hit_pct":
        actual = snap.daily_pnl / bal * 100 if snap.daily_pnl > 0 else 0
        return actual >= cv, actual

    return False, 0.0


def execute_action(rule: RiskRule, user_id: int, db: Session):
    """Execute the rule's action"""
    at = rule.action_type
    av = rule.action_value or 30  # default 30 min cooldown

    if at == "block_new_trades":
        block = db.query(TradeBlock).filter(TradeBlock.user_id == user_id).first()
        if not block:
            block = TradeBlock(user_id=user_id)
            db.add(block)
        block.is_blocked  = True
        block.reason      = f"Rule: {rule.name}"
        block.rule_name   = rule.name
        block.blocked_at  = datetime.utcnow()
        block.unblocks_at = None  # manual unblock
        logger.info(f"🚫 Trade BLOCKED for user {user_id} by rule: {rule.name}")

    elif at == "start_cooldown":
        # Deactivate existing cooldowns
        db.query(CooldownSession).filter(
            CooldownSession.user_id == user_id,
            CooldownSession.is_active == True
        ).update({"is_active": False})

        ends_at = datetime.utcnow() + timedelta(minutes=int(av))
        cooldown = CooldownSession(
            user_id=user_id,
            reason="risk_rule",
            ends_at=ends_at,
            notes=f"Auto-triggered by rule: {rule.name}",
            is_active=True
        )
        db.add(cooldown)
        logger.info(f"⏱️ Cooldown {av}min started for user {user_id} by rule: {rule.name}")

    elif at == "send_alert":
        # Alert is returned in the evaluate response — frontend shows it
        logger.info(f"🔔 Alert triggered for user {user_id} by rule: {rule.name}")

    elif at == "reduce_risk":
        # Flag stored in block record for frontend to read
        block = db.query(TradeBlock).filter(TradeBlock.user_id == user_id).first()
        if not block:
            block = TradeBlock(user_id=user_id)
            db.add(block)
        block.reason    = f"Reduce risk by {av}% — Rule: {rule.name}"
        block.rule_name = rule.name
        logger.info(f"⚠️ Reduce risk flag set for user {user_id}")


# ═══════════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════════

@router.get("/condition-types")
def get_condition_types():
    return {"conditions": CONDITION_TYPES, "actions": ACTION_TYPES}


@router.get("/")
def list_rules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rules = db.query(RiskRule).filter(
        RiskRule.user_id == current_user.id
    ).order_by(RiskRule.created_at.desc()).all()

    return {"rules": [
        {
            "id":              r.id,
            "name":            r.name,
            "condition_type":  r.condition_type,
            "condition_value": r.condition_value,
            "condition_label": CONDITION_TYPES.get(r.condition_type, r.condition_type),
            "action_type":     r.action_type,
            "action_value":    r.action_value,
            "action_label":    ACTION_TYPES.get(r.action_type, r.action_type),
            "is_active":       r.is_active,
            "trigger_count":   r.trigger_count,
            "last_triggered":  r.last_triggered.isoformat() if r.last_triggered else None,
            "notes":           r.notes,
            "created_at":      r.created_at.isoformat(),
        } for r in rules
    ]}


@router.post("/")
def create_rule(
    req: RuleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if req.condition_type not in CONDITION_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid condition_type. Choose from: {list(CONDITION_TYPES.keys())}")
    if req.action_type not in ACTION_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid action_type. Choose from: {list(ACTION_TYPES.keys())}")

    # Enforce enterprise plan (case-insensitive check)
    user_plan = (getattr(current_user, "plan", "free") or "free").lower().strip()
    logger.info(f"Rule create attempt — user: {current_user.username}, plan: {user_plan}")
    if user_plan != "enterprise":
        raise HTTPException(
            status_code=403,
            detail=f"Custom Risk Rules require Enterprise plan. Your current plan: '{user_plan}'. Run force_enterprise.py to upgrade."
        )

    rule = RiskRule(
        user_id         = current_user.id,
        name            = req.name,
        condition_type  = req.condition_type,
        condition_value = req.condition_value,
        action_type     = req.action_type,
        action_value    = req.action_value,
        notes           = req.notes,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return {"success": True, "rule_id": rule.id, "message": f"Rule '{rule.name}' created"}


@router.put("/{rule_id}")
def update_rule(
    rule_id: int,
    req: RuleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rule = db.query(RiskRule).filter(RiskRule.id == rule_id, RiskRule.user_id == current_user.id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    for field, val in req.dict(exclude_none=True).items():
        setattr(rule, field, val)
    db.commit()
    return {"success": True, "message": "Rule updated"}


@router.delete("/{rule_id}")
def delete_rule(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rule = db.query(RiskRule).filter(RiskRule.id == rule_id, RiskRule.user_id == current_user.id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
    return {"success": True, "message": f"Rule '{rule.name}' deleted"}


@router.post("/{rule_id}/toggle")
def toggle_rule(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rule = db.query(RiskRule).filter(RiskRule.id == rule_id, RiskRule.user_id == current_user.id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    rule.is_active = not rule.is_active
    db.commit()
    return {"success": True, "is_active": rule.is_active}


@router.post("/evaluate")
def evaluate_rules(
    snap: AccountSnapshot,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Called by frontend every 30s with current account metrics.
    Evaluates all active rules and fires actions for any that trigger.
    """
    rules = db.query(RiskRule).filter(
        RiskRule.user_id  == current_user.id,
        RiskRule.is_active == True
    ).all()

    triggered = []
    alerts    = []

    for rule in rules:
        fired, actual_val = evaluate_condition(rule, snap)
        if fired:
            # Log the trigger
            log = RuleTriggerLog(
                rule_id        = rule.id,
                user_id        = current_user.id,
                condition_type = rule.condition_type,
                condition_value= rule.condition_value,
                actual_value   = actual_val,
                action_type    = rule.action_type,
                action_value   = rule.action_value,
                rule_name      = rule.name,
            )
            db.add(log)

            # Update rule stats
            rule.trigger_count  += 1
            rule.last_triggered  = datetime.utcnow()

            # Execute action
            execute_action(rule, current_user.id, db)

            triggered.append({
                "rule_id":      rule.id,
                "rule_name":    rule.name,
                "action":       rule.action_type,
                "action_value": rule.action_value,
                "actual_value": round(actual_val, 2),
                "message":      f"⚠️ Rule '{rule.name}' triggered! {ACTION_TYPES.get(rule.action_type)}",
            })
            alerts.append(f"Rule '{rule.name}' fired → {ACTION_TYPES.get(rule.action_type, rule.action_type)}")

    db.commit()

    # Get current block status
    block = db.query(TradeBlock).filter(TradeBlock.user_id == current_user.id).first()
    is_blocked = block.is_blocked if block else False

    return {
        "evaluated":   len(rules),
        "triggered":   len(triggered),
        "triggered_rules": triggered,
        "is_blocked":  is_blocked,
        "block_reason": block.reason if block and block.is_blocked else "",
        "alerts":      alerts,
    }


@router.get("/status")
def get_block_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if user is currently trade-blocked"""
    block = db.query(TradeBlock).filter(TradeBlock.user_id == current_user.id).first()

    # Auto-unblock if unblocks_at has passed
    if block and block.is_blocked and block.unblocks_at:
        if datetime.utcnow() >= block.unblocks_at:
            block.is_blocked = False
            db.commit()

    return {
        "is_blocked":  block.is_blocked if block else False,
        "reason":      block.reason if block else "",
        "rule_name":   block.rule_name if block else "",
        "blocked_at":  block.blocked_at.isoformat() if block and block.blocked_at else None,
        "unblocks_at": block.unblocks_at.isoformat() if block and block.unblocks_at else None,
    }


@router.post("/unblock")
def unblock_trades(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually unblock trades (override rule block)"""
    block = db.query(TradeBlock).filter(TradeBlock.user_id == current_user.id).first()
    if block:
        block.is_blocked  = False
        block.reason      = ""
        block.rule_name   = ""
        db.commit()
    return {"success": True, "message": "Trade block removed"}


@router.get("/history")
def get_trigger_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    logs = db.query(RuleTriggerLog).filter(
        RuleTriggerLog.user_id == current_user.id
    ).order_by(RuleTriggerLog.triggered_at.desc()).limit(50).all()

    return {"history": [
        {
            "rule_name":      l.rule_name,
            "condition_type": l.condition_type,
            "condition_value":l.condition_value,
            "actual_value":   round(l.actual_value, 2),
            "action_type":    l.action_type,
            "action_value":   l.action_value,
            "triggered_at":   l.triggered_at.isoformat(),
        } for l in logs
    ]}


