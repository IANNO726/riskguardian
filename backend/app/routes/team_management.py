"""
Team Management — Backend

How it works:
  - Owner invites a user by email + role
  - Invite record is created with a unique token
  - Invited user registers/logs in and accepts via token
  - They get linked to the owner's team with their role
  - Owner can see all members, change roles, remove members

Roles:
  owner       - full access (cannot be changed)
  risk_manager - can view all, manage risk rules
  analyst     - can view all data, no changes
  trader      - can view their own data
  viewer      - read-only dashboard

Routes:
  GET    /api/v1/team/members              → list team members
  POST   /api/v1/team/invite               → send invite
  GET    /api/v1/team/invites              → list pending invites
  DELETE /api/v1/team/invites/{id}         → cancel invite
  PUT    /api/v1/team/members/{id}/role    → change role
  DELETE /api/v1/team/members/{id}         → remove member
  POST   /api/v1/team/accept/{token}       → accept invite (called by invitee)
  GET    /api/v1/team/my-team              → get which team I belong to
"""
import secrets
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from app.database.database import Base, get_db
from app.routes.auth_multi import get_current_user
from app.models.user import User
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

ROLES = ['owner', 'risk_manager', 'analyst', 'trader', 'viewer']
ROLE_COLORS = {
    'owner':        '#f59e0b',
    'risk_manager': '#a855f7',
    'analyst':      '#38bdf8',
    'trader':       '#22c55e',
    'viewer':       '#6b7280',
}

# ═══════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════
class TeamMember(Base):
    __tablename__ = "team_members"
    id         = Column(Integer, primary_key=True)
    owner_id   = Column(Integer, ForeignKey("users.id"), nullable=False)  # the enterprise user
    member_id  = Column(Integer, ForeignKey("users.id"), nullable=True)   # linked account (null if pending)
    email      = Column(String, nullable=False)
    role       = Column(String, default="trader")
    joined_at  = Column(DateTime, nullable=True)
    is_active  = Column(Boolean, default=True)

class TeamInvite(Base):
    __tablename__ = "team_invites"
    id         = Column(Integer, primary_key=True)
    owner_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    email      = Column(String, nullable=False)
    role       = Column(String, default="trader")
    token      = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    accepted   = Column(Boolean, default=False)

# ═══════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════
class InviteRequest(BaseModel):
    email: str
    role:  str = "trader"

class RoleUpdate(BaseModel):
    role: str

# ═══════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════
def check_enterprise(user: User):
    plan = (getattr(user, "plan", "free") or "free").lower().strip()
    if plan != "enterprise":
        raise HTTPException(status_code=403, detail="Team Management requires Enterprise plan")

def get_user_display(user: User) -> dict:
    name = getattr(user, 'full_name', None) or getattr(user, 'username', 'Unknown')
    return {
        "id":       user.id,
        "name":     name,
        "email":    user.email,
        "username": getattr(user, 'username', ''),
        "avatar":   name[0].upper() if name else "?",
    }

# ═══════════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════════
@router.get("/members")
def list_members(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_enterprise(current_user)
    members = db.query(TeamMember).filter(
        TeamMember.owner_id  == current_user.id,
        TeamMember.is_active == True
    ).all()

    result = []
    # Add owner first
    owner_display = get_user_display(current_user)
    result.append({
        **owner_display,
        "role":      "owner",
        "role_color": ROLE_COLORS["owner"],
        "joined_at": current_user.created_at.isoformat() if hasattr(current_user, 'created_at') and current_user.created_at else None,
        "is_you":    True,
        "member_id": None,
    })

    for m in members:
        linked = db.query(User).filter(User.id == m.member_id).first() if m.member_id else None
        if linked:
            display = get_user_display(linked)
        else:
            display = {"id": None, "name": m.email.split("@")[0], "email": m.email,
                       "username": m.email, "avatar": m.email[0].upper()}
        result.append({
            **display,
            "role":       m.role,
            "role_color": ROLE_COLORS.get(m.role, '#6b7280'),
            "joined_at":  m.joined_at.isoformat() if m.joined_at else None,
            "is_you":     False,
            "member_id":  m.id,
            "pending":    m.member_id is None,
        })

    return {"members": result, "total": len(result), "roles": ROLES, "role_colors": ROLE_COLORS}


@router.post("/invite")
def invite_member(
    req: InviteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_enterprise(current_user)
    if req.role not in ROLES or req.role == 'owner':
        raise HTTPException(status_code=400, detail=f"Invalid role. Choose from: {[r for r in ROLES if r != 'owner']}")

    # Check not already a member
    existing_member = db.query(TeamMember).filter(
        TeamMember.owner_id == current_user.id,
        TeamMember.email    == req.email.lower(),
        TeamMember.is_active == True
    ).first()
    if existing_member:
        raise HTTPException(status_code=400, detail="This email is already a team member")

    # Cancel any existing pending invite for this email
    db.query(TeamInvite).filter(
        TeamInvite.owner_id == current_user.id,
        TeamInvite.email    == req.email.lower(),
        TeamInvite.accepted == False
    ).delete()

    token = secrets.token_urlsafe(32)
    invite = TeamInvite(
        owner_id   = current_user.id,
        email      = req.email.lower(),
        role       = req.role,
        token      = token,
        expires_at = datetime.utcnow() + timedelta(days=7),
    )
    db.add(invite)
    db.commit()

    owner_name = getattr(current_user, 'full_name', None) or getattr(current_user, 'username', 'Your manager')
    accept_url = f"http://192.168.43.131:3000/accept-invite?token={token}"

    return {
        "success":    True,
        "message":    f"Invite created for {req.email}",
        "token":      token,
        "accept_url": accept_url,
        "note":       f"Share this link with {req.email}: {accept_url}",
        "expires_in": "7 days",
    }


@router.get("/invites")
def list_invites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_enterprise(current_user)
    invites = db.query(TeamInvite).filter(
        TeamInvite.owner_id  == current_user.id,
        TeamInvite.accepted  == False,
        TeamInvite.expires_at > datetime.utcnow()
    ).all()
    return {"invites": [
        {"id": i.id, "email": i.email, "role": i.role,
         "created_at": i.created_at.isoformat(),
         "expires_at": i.expires_at.isoformat(),
         "token": i.token}
        for i in invites
    ]}


@router.delete("/invites/{invite_id}")
def cancel_invite(
    invite_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    invite = db.query(TeamInvite).filter(
        TeamInvite.id       == invite_id,
        TeamInvite.owner_id == current_user.id
    ).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    db.delete(invite)
    db.commit()
    return {"success": True}


@router.put("/members/{member_id}/role")
def change_role(
    member_id: int,
    req: RoleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_enterprise(current_user)
    if req.role not in ROLES or req.role == 'owner':
        raise HTTPException(status_code=400, detail="Invalid role")
    member = db.query(TeamMember).filter(
        TeamMember.id       == member_id,
        TeamMember.owner_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    member.role = req.role
    db.commit()
    return {"success": True, "role": member.role, "role_color": ROLE_COLORS.get(req.role)}


@router.delete("/members/{member_id}")
def remove_member(
    member_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_enterprise(current_user)
    member = db.query(TeamMember).filter(
        TeamMember.id       == member_id,
        TeamMember.owner_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    member.is_active = False
    db.commit()
    return {"success": True, "message": f"{member.email} removed from team"}


@router.post("/accept/{token}")
def accept_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Called when an invited user clicks the invite link after logging in."""
    invite = db.query(TeamInvite).filter(
        TeamInvite.token    == token,
        TeamInvite.accepted == False,
        TeamInvite.expires_at > datetime.utcnow()
    ).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found or expired")
    if current_user.email.lower() != invite.email.lower():
        raise HTTPException(status_code=403, detail=f"This invite was sent to {invite.email}")

    # Create team member record
    member = TeamMember(
        owner_id  = invite.owner_id,
        member_id = current_user.id,
        email     = invite.email,
        role      = invite.role,
        joined_at = datetime.utcnow(),
        is_active = True,
    )
    db.add(member)
    invite.accepted = True
    db.commit()
    return {"success": True, "message": f"Welcome to the team! Your role: {invite.role}",
            "role": invite.role}


@router.get("/my-team")
def get_my_team(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if current user belongs to someone's team."""
    membership = db.query(TeamMember).filter(
        TeamMember.member_id == current_user.id,
        TeamMember.is_active == True
    ).first()
    if not membership:
        return {"in_team": False}
    owner = db.query(User).filter(User.id == membership.owner_id).first()
    owner_name = getattr(owner, 'full_name', None) or getattr(owner, 'username', 'Unknown') if owner else 'Unknown'
    return {
        "in_team":    True,
        "role":       membership.role,
        "role_color": ROLE_COLORS.get(membership.role, '#6b7280'),
        "owner_name": owner_name,
        "joined_at":  membership.joined_at.isoformat() if membership.joined_at else None,
    }