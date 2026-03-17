"""
White Label Branding — Backend
Stores per-user brand settings and serves them on load.

Routes:
  GET  /api/v1/white-label/        → get current branding
  POST /api/v1/white-label/        → save branding
  GET  /api/v1/white-label/public/{user_id} → public (no auth) for AppShell load
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, ForeignKey
from app.database.database import Base, get_db
from app.routes.auth_multi import get_current_user
from app.models.user import User
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

# ── Model ────────────────────────────────────────────────
class WhiteLabelBranding(Base):
    __tablename__ = "white_label_branding"
    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    brand_name    = Column(String, default="RiskGuardian")
    primary_color = Column(String, default="#38bdf8")
    logo_url      = Column(String, default="")

# ── Schemas ──────────────────────────────────────────────
class BrandingUpdate(BaseModel):
    brand_name:    str
    primary_color: str
    logo_url:      Optional[str] = ""

DEFAULT = {"brand_name": "RiskGuardian", "primary_color": "#38bdf8", "logo_url": ""}

# ── Routes ───────────────────────────────────────────────
@router.get("/")
def get_branding(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    b = db.query(WhiteLabelBranding).filter(WhiteLabelBranding.user_id == current_user.id).first()
    if not b:
        return DEFAULT
    return {"brand_name": b.brand_name, "primary_color": b.primary_color, "logo_url": b.logo_url or ""}


@router.post("/")
def save_branding(
    req: BrandingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Enforce enterprise plan
    user_plan = (getattr(current_user, "plan", "free") or "free").lower().strip()
    if user_plan != "enterprise":
        raise HTTPException(status_code=403, detail="White Label requires Enterprise plan")

    b = db.query(WhiteLabelBranding).filter(WhiteLabelBranding.user_id == current_user.id).first()
    if not b:
        b = WhiteLabelBranding(user_id=current_user.id)
        db.add(b)

    b.brand_name    = req.brand_name.strip() or "RiskGuardian"
    b.primary_color = req.primary_color.strip() or "#38bdf8"
    b.logo_url      = req.logo_url or ""
    db.commit()
    return {"success": True, "brand_name": b.brand_name, "primary_color": b.primary_color, "logo_url": b.logo_url}