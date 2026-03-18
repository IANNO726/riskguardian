"""
API Keys & Webhooks — Backend

Routes:
  GET    /api/v1/api-access/key           → get or generate API key
  POST   /api/v1/api-access/key/regenerate → regenerate key
  DELETE /api/v1/api-access/key           → revoke key

  GET    /api/v1/api-access/webhooks      → list webhooks
  POST   /api/v1/api-access/webhooks      → add webhook
  DELETE /api/v1/api-access/webhooks/{id} → delete webhook
  POST   /api/v1/api-access/webhooks/{id}/toggle → toggle active
  POST   /api/v1/api-access/webhooks/deliver → deliver event to all active webhooks
  GET    /api/v1/api-access/webhooks/logs → delivery log

  GET    /api/v1/api-access/validate      → validate an API key (used by external requests)
"""
import secrets
import hashlib
import httpx
import json
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from app.database.database import Base, get_db
from app.routes.auth_multi import get_current_user
from app.models.user import User
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

VALID_EVENTS = [
    'position.opened', 'position.closed', 'risk.limit_hit',
    'risk.drawdown_exceeded', 'account.balance_update',
    'cooldown.started', 'journal.entry_created', 'rule.triggered',
]

# ═══════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════
class APIKey(Base):
    __tablename__ = "enterprise_api_keys"
    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    key_prefix = Column(String, nullable=False)           # rg_live_xxxx (shown to user)
    key_hash   = Column(String, nullable=False)           # sha256 hash (stored)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used  = Column(DateTime, nullable=True)
    is_active  = Column(Boolean, default=True)

class Webhook(Base):
    __tablename__ = "enterprise_webhooks"
    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    url        = Column(String, nullable=False)
    event      = Column(String, nullable=False)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_fired = Column(DateTime, nullable=True)
    fail_count = Column(Integer, default=0)

class WebhookLog(Base):
    __tablename__ = "enterprise_webhook_logs"
    id          = Column(Integer, primary_key=True)
    webhook_id  = Column(Integer, ForeignKey("enterprise_webhooks.id"))
    user_id     = Column(Integer, ForeignKey("users.id"))
    event       = Column(String)
    payload     = Column(Text)
    status_code = Column(Integer, nullable=True)
    success     = Column(Boolean, default=False)
    fired_at    = Column(DateTime, default=datetime.utcnow)
    error       = Column(Text, nullable=True)

# ═══════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════
def generate_api_key() -> tuple[str, str]:
    """Returns (full_key, hash). Only full_key is shown once."""
    raw = secrets.token_hex(24)
    full_key = f"rg_live_{raw}"
    hashed   = hashlib.sha256(full_key.encode()).hexdigest()
    return full_key, hashed

def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()

def check_enterprise(user: User):
    plan = (getattr(user, "plan", "free") or "free").lower().strip()
    if plan != "enterprise":
        raise HTTPException(status_code=403, detail="API Access requires Enterprise plan")

# ═══════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════
class WebhookCreate(BaseModel):
    url:   str
    event: str

class WebhookDeliverRequest(BaseModel):
    event:   str
    payload: dict = {}

# ═══════════════════════════════════════════════════════════
# API KEY ROUTES
# ═══════════════════════════════════════════════════════════
@router.get("/key")
def get_or_create_key(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_enterprise(current_user)
    existing = db.query(APIKey).filter(APIKey.user_id == current_user.id).first()
    if existing and existing.is_active:
        # Return masked key — only prefix shown after creation
        return {
            "key_prefix": existing.key_prefix,
            "masked":     existing.key_prefix[:16] + "••••••••••••••••",
            "created_at": existing.created_at.isoformat(),
            "last_used":  existing.last_used.isoformat() if existing.last_used else None,
            "is_new":     False,
        }
    # Generate new key
    full_key, hashed = generate_api_key()
    if existing:
        existing.key_prefix = full_key[:20]
        existing.key_hash   = hashed
        existing.created_at = datetime.utcnow()
        existing.is_active  = True
    else:
        db.add(APIKey(user_id=current_user.id, key_prefix=full_key[:20], key_hash=hashed))
    db.commit()
    return {"key_prefix": full_key[:20], "full_key": full_key, "is_new": True,
            "warning": "Save this key now — it will not be shown again!"}


@router.post("/key/regenerate")
def regenerate_key(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_enterprise(current_user)
    full_key, hashed = generate_api_key()
    existing = db.query(APIKey).filter(APIKey.user_id == current_user.id).first()
    if existing:
        existing.key_prefix = full_key[:20]
        existing.key_hash   = hashed
        existing.created_at = datetime.utcnow()
        existing.is_active  = True
    else:
        db.add(APIKey(user_id=current_user.id, key_prefix=full_key[:20], key_hash=hashed))
    db.commit()
    return {"full_key": full_key, "key_prefix": full_key[:20], "is_new": True,
            "warning": "Save this key — it will not be shown again!"}


@router.delete("/key")
def revoke_key(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_enterprise(current_user)
    key = db.query(APIKey).filter(APIKey.user_id == current_user.id).first()
    if key:
        key.is_active = False
        db.commit()
    return {"success": True, "message": "API key revoked"}


@router.get("/validate")
def validate_key(
    x_api_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Used by external systems to validate their API key."""
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing X-API-Key header")
    hashed = hash_key(x_api_key)
    key = db.query(APIKey).filter(APIKey.key_hash == hashed, APIKey.is_active == True).first()
    if not key:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key")
    key.last_used = datetime.utcnow()
    db.commit()
    return {"valid": True, "user_id": key.user_id}


# ═══════════════════════════════════════════════════════════
# WEBHOOK ROUTES
# ═══════════════════════════════════════════════════════════
@router.get("/webhooks")
def list_webhooks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_enterprise(current_user)
    hooks = db.query(Webhook).filter(Webhook.user_id == current_user.id).all()
    return {"webhooks": [
        {"id": h.id, "url": h.url, "event": h.event, "is_active": h.is_active,
         "last_fired": h.last_fired.isoformat() if h.last_fired else None,
         "fail_count": h.fail_count, "created_at": h.created_at.isoformat()}
        for h in hooks
    ], "valid_events": VALID_EVENTS}


@router.post("/webhooks")
def add_webhook(
    req: WebhookCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_enterprise(current_user)
    if req.event not in VALID_EVENTS:
        raise HTTPException(status_code=400, detail=f"Invalid event. Choose from: {VALID_EVENTS}")
    if not req.url.startswith("http"):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")
    hook = Webhook(user_id=current_user.id, url=req.url, event=req.event)
    db.add(hook)
    db.commit()
    db.refresh(hook)
    return {"success": True, "id": hook.id, "url": hook.url, "event": hook.event}


@router.delete("/webhooks/{hook_id}")
def delete_webhook(
    hook_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    hook = db.query(Webhook).filter(Webhook.id == hook_id, Webhook.user_id == current_user.id).first()
    if not hook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    db.delete(hook)
    db.commit()
    return {"success": True}


@router.post("/webhooks/{hook_id}/toggle")
def toggle_webhook(
    hook_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    hook = db.query(Webhook).filter(Webhook.id == hook_id, Webhook.user_id == current_user.id).first()
    if not hook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    hook.is_active = not hook.is_active
    db.commit()
    return {"success": True, "is_active": hook.is_active}


@router.post("/webhooks/test/{hook_id}")
async def test_webhook(
    hook_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a test payload to a webhook URL."""
    hook = db.query(Webhook).filter(Webhook.id == hook_id, Webhook.user_id == current_user.id).first()
    if not hook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    payload = {"event": hook.event, "test": True, "timestamp": datetime.utcnow().isoformat(),
               "data": {"message": "This is a test delivery from RiskGuardian"}}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(hook.url, json=payload,
                headers={"Content-Type": "application/json", "X-RiskGuardian-Event": hook.event})
        return {"success": r.status_code < 400, "status_code": r.status_code,
                "message": f"Delivered with status {r.status_code}"}
    except Exception as e:
        return {"success": False, "error": str(e), "message": "Delivery failed — check your URL"}


@router.post("/webhooks/deliver")
async def deliver_event(
    req: WebhookDeliverRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Trigger delivery of an event to all matching active webhooks."""
    hooks = db.query(Webhook).filter(
        Webhook.user_id == current_user.id,
        Webhook.event   == req.event,
        Webhook.is_active == True
    ).all()

    async def fire(hook_id: int, url: str, event: str, payload: dict):
        full_payload = {"event": event, "timestamp": datetime.utcnow().isoformat(), "data": payload}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(url, json=full_payload,
                    headers={"Content-Type": "application/json", "X-RiskGuardian-Event": event})
            success = r.status_code < 400
        except Exception as e:
            success = False

    for h in hooks:
        background_tasks.add_task(fire, h.id, h.url, req.event, req.payload)
        h.last_fired = datetime.utcnow()
    db.commit()

    return {"success": True, "delivered_to": len(hooks), "event": req.event}


@router.get("/webhooks/logs")
def get_webhook_logs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    logs = db.query(WebhookLog).filter(
        WebhookLog.user_id == current_user.id
    ).order_by(WebhookLog.fired_at.desc()).limit(50).all()
    return {"logs": [
        {"event": l.event, "success": l.success, "status_code": l.status_code,
         "fired_at": l.fired_at.isoformat(), "error": l.error}
        for l in logs
    ]}


