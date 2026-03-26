"""
Agent Routes — Windows MT5 Agent Integration
=============================================
Endpoints:
  POST /api/v1/agent/push        — agent pushes live MT5 data
  GET  /api/v1/agent/latest      — dashboard reads latest data
  POST /api/v1/agent/token/generate — user generates agent token
  GET  /api/v1/agent/token       — get current agent token
  DELETE /api/v1/agent/token     — revoke agent token
  GET  /api/v1/agent/status      — check if agent is connected
"""

import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import Session
import json

from app.database.database import Base, get_db
from app.models.user import User
from app.routes.auth_multi import get_current_user

router = APIRouter(tags=["Agent"])
logger = logging.getLogger(__name__)


# ── In-memory cache for latest agent data (per user_id) ──────────────────────
# This avoids a DB write every 5 seconds — we only write to DB every 30s
_agent_cache: dict = {}   # {user_id: {data, received_at}}


# ── DB Models ─────────────────────────────────────────────────────────────────

class AgentToken(Base):
    __tablename__ = "agent_tokens"
    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    token      = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used  = Column(DateTime, nullable=True)
    is_active  = Column(Boolean, default=True)


class AgentData(Base):
    __tablename__ = "agent_data"
    id             = Column(Integer, primary_key=True)
    user_id        = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    balance        = Column(Float,   default=0.0)
    equity         = Column(Float,   default=0.0)
    profit         = Column(Float,   default=0.0)   # open P&L
    today_pnl      = Column(Float,   default=0.0)   # closed P&L today
    margin         = Column(Float,   default=0.0)
    margin_free    = Column(Float,   default=0.0)
    currency       = Column(String,  default="USD")
    leverage       = Column(Integer, default=1000)
    login          = Column(String,  nullable=True)
    positions_json = Column(Text,    default="[]")
    positions_count = Column(Integer, default=0)
    last_updated   = Column(DateTime, nullable=True)
    agent_version  = Column(String,  nullable=True)


# ── Auth helpers ──────────────────────────────────────────────────────────────

def _get_user_by_agent_token(token: str, db: Session) -> Optional[User]:
    """Look up user from agent token."""
    agent_token = db.query(AgentToken).filter_by(token=token, is_active=True).first()
    if not agent_token:
        return None
    # Update last_used (non-blocking)
    agent_token.last_used = datetime.utcnow()
    db.commit()
    return db.query(User).filter_by(id=agent_token.user_id).first()


# ── PUSH endpoint (called by agent every 5 seconds) ───────────────────────────

@router.post("/push")
async def agent_push(
    payload: dict,
    authorization: str = Header(...),
    db: Session = Depends(get_db),
):
    """
    Receives live MT5 data from user's Windows agent.
    Authenticated with agent token (not JWT).
    """
    # Extract token from Bearer header
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.replace("Bearer ", "").strip()

    user = _get_user_by_agent_token(token, db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid agent token")

    # Cache in memory (always)
    _agent_cache[user.id] = {
        "data":        payload,
        "received_at": datetime.utcnow().isoformat(),
    }

    # Write to DB every 30s (not every 5s — reduces DB load)
    agent_data = db.query(AgentData).filter_by(user_id=user.id).first()
    now = datetime.utcnow()
    should_write = (
        agent_data is None or
        agent_data.last_updated is None or
        (now - agent_data.last_updated).total_seconds() > 30
    )

    if should_write:
        positions = payload.get("positions", [])
        if agent_data is None:
            agent_data = AgentData(user_id=user.id)
            db.add(agent_data)

        agent_data.balance         = float(payload.get("balance",     0))
        agent_data.equity          = float(payload.get("equity",      0))
        agent_data.profit          = float(payload.get("profit",      0))
        agent_data.today_pnl       = float(payload.get("today_pnl",   0))
        agent_data.margin          = float(payload.get("margin",      0))
        agent_data.margin_free     = float(payload.get("margin_free", 0))
        agent_data.currency        = payload.get("currency", "USD")
        agent_data.leverage        = int(payload.get("leverage", 1000))
        agent_data.login           = payload.get("login", "")
        agent_data.positions_json  = json.dumps(positions)
        agent_data.positions_count = len(positions)
        agent_data.last_updated    = now
        agent_data.agent_version   = payload.get("agent_version", "")
        db.commit()

    logger.info(
        f"Agent push: user={user.id} balance={payload.get('balance')} "
        f"equity={payload.get('equity')} positions={len(payload.get('positions', []))}"
    )

    return {"status": "ok", "received_at": now.isoformat()}


# ── LATEST endpoint (called by dashboard) ─────────────────────────────────────

@router.get("/latest")
async def get_latest_agent_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns the latest data pushed by the user's Windows agent."""

    # Try memory cache first (freshest data)
    cached = _agent_cache.get(current_user.id)
    if cached:
        age_seconds = (
            datetime.utcnow() -
            datetime.fromisoformat(cached["received_at"])
        ).total_seconds()

        return {
            "connected":    age_seconds < 30,   # connected if pushed in last 30s
            "age_seconds":  round(age_seconds),
            "data":         cached["data"],
            "source":       "cache",
        }

    # Fall back to DB
    agent_data = db.query(AgentData).filter_by(user_id=current_user.id).first()
    if not agent_data:
        return {
            "connected": False,
            "age_seconds": None,
            "data": None,
            "source": "none",
        }

    age_seconds = None
    connected   = False
    if agent_data.last_updated:
        age_seconds = (datetime.utcnow() - agent_data.last_updated).total_seconds()
        connected   = age_seconds < 30

    return {
        "connected":   connected,
        "age_seconds": round(age_seconds) if age_seconds else None,
        "data": {
            "balance":         agent_data.balance,
            "equity":          agent_data.equity,
            "profit":          agent_data.profit,
            "today_pnl":       agent_data.today_pnl,
            "margin":          agent_data.margin,
            "margin_free":     agent_data.margin_free,
            "currency":        agent_data.currency,
            "leverage":        agent_data.leverage,
            "login":           agent_data.login,
            "positions":       json.loads(agent_data.positions_json or "[]"),
            "positions_count": agent_data.positions_count,
            "last_updated":    agent_data.last_updated.isoformat() if agent_data.last_updated else None,
        },
        "source": "db",
    }


# ── STATUS endpoint ───────────────────────────────────────────────────────────

@router.get("/status")
async def get_agent_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Quick check — is the agent connected and pushing data?"""
    cached = _agent_cache.get(current_user.id)
    if cached:
        age = (
            datetime.utcnow() -
            datetime.fromisoformat(cached["received_at"])
        ).total_seconds()
        return {
            "connected":   age < 30,
            "age_seconds": round(age),
            "last_push":   cached["received_at"],
        }

    agent_data = db.query(AgentData).filter_by(user_id=current_user.id).first()
    if not agent_data or not agent_data.last_updated:
        return {"connected": False, "age_seconds": None, "last_push": None}

    age = (datetime.utcnow() - agent_data.last_updated).total_seconds()
    return {
        "connected":   age < 30,
        "age_seconds": round(age),
        "last_push":   agent_data.last_updated.isoformat(),
    }


# ── TOKEN MANAGEMENT ──────────────────────────────────────────────────────────

@router.post("/token/generate")
async def generate_agent_token(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a new agent token for the current user."""
    # Revoke old token if exists
    old = db.query(AgentToken).filter_by(user_id=current_user.id).first()
    if old:
        db.delete(old)

    token = f"rga_{secrets.token_urlsafe(32)}"
    db.add(AgentToken(
        user_id    = current_user.id,
        token      = token,
        created_at = datetime.utcnow(),
        is_active  = True,
    ))
    db.commit()

    logger.info(f"Agent token generated for user {current_user.id}")
    return {
        "token":      token,
        "created_at": datetime.utcnow().isoformat(),
        "message":    "Copy this token into your RiskGuardian Agent app",
    }


@router.get("/token")
async def get_agent_token(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current agent token (masked for security)."""
    agent_token = db.query(AgentToken).filter_by(
        user_id=current_user.id, is_active=True
    ).first()

    if not agent_token:
        return {"has_token": False, "token_preview": None}

    token   = agent_token.token
    preview = token[:8] + "..." + token[-4:]
    return {
        "has_token":    True,
        "token_preview": preview,
        "created_at":   agent_token.created_at.isoformat(),
        "last_used":    agent_token.last_used.isoformat() if agent_token.last_used else None,
    }


@router.delete("/token")
async def revoke_agent_token(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke the agent token — agent will stop being able to push data."""
    deleted = db.query(AgentToken).filter_by(user_id=current_user.id).delete()
    db.commit()
    # Clear memory cache
    _agent_cache.pop(current_user.id, None)
    return {"revoked": bool(deleted)}