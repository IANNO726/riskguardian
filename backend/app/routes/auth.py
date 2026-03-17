from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.user import User
from app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
)

# ✅ Rate limiter — uses client IP address as the key
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(tags=["Auth"])


# ======================
# REGISTER
# ✅ Rate limited: 5 registrations per minute per IP
# ======================
@router.post("/register")
@limiter.limit("5/minute")
def register(request: Request, data: dict, db: Session = Depends(get_db)):

    if db.query(User).filter(User.email == data["email"]).first():
        raise HTTPException(status_code=400, detail="Email already exists")

    if db.query(User).filter(User.username == data["username"]).first():
        raise HTTPException(status_code=400, detail="Username already exists")

    user = User(
        username=data["username"],
        email=data["email"],
        full_name=data.get("full_name", ""),
        hashed_password=hash_password(data["password"]),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # ✅ Welcome email with personal Telegram connect link
    try:
        import os, threading
        from app.routes.telegram import generate_connect_link
        from app.emails.email_service import send_welcome_email_with_telegram

        FRONTEND_URL = os.getenv("FRONTEND_URL", "http://192.168.43.131:3000")
        tg_link      = generate_connect_link(user.id)

        threading.Thread(
            target=send_welcome_email_with_telegram,
            args=(user.email, user.username, FRONTEND_URL, tg_link),
            daemon=True,
        ).start()
    except Exception:
        pass

    return {"message": "User created successfully"}


# ======================
# LOGIN
# ✅ Rate limited: 10 attempts per minute per IP
# ======================
@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, data: dict, db: Session = Depends(get_db)):

    user = db.query(User).filter(User.username == data["username"]).first()

    # ✅ Same error for wrong username or wrong password — prevents user enumeration
    if not user or not verify_password(data["password"], user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token  = create_access_token({"sub": user.username})
    refresh_token = create_refresh_token({"sub": user.username})

    return {
        "access_token":  access_token,
        "refresh_token": refresh_token,
        "token_type":    "bearer",
    }


# ======================
# REFRESH TOKEN
# ✅ Exchange a refresh token for a new access token
# Rate limited: 20/minute (apps auto-refresh frequently)
# ======================
@router.post("/refresh")
@limiter.limit("20/minute")
def refresh_token(request: Request, data: dict, db: Session = Depends(get_db)):
    """
    Body: {"refresh_token": "<token>"}
    Returns a new access_token without requiring re-login.

    Frontend usage:
        On 401 response → POST /api/v1/auth/refresh with stored refresh_token
        Store new access_token → retry original request
    """
    token    = data.get("refresh_token")
    if not token:
        raise HTTPException(status_code=400, detail="refresh_token is required")

    username = decode_refresh_token(token)

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    new_access_token = create_access_token({"sub": user.username})

    return {
        "access_token": new_access_token,
        "token_type":   "bearer",
    }
