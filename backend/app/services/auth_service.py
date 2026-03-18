from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.user import User
import os

# ======================
# CONFIG
# ======================
SECRET_KEY       = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production-12345")
ALGORITHM        = os.getenv("JWT_ALGORITHM",  "HS256")

# ✅ Production-safe expiry — short-lived access token + long-lived refresh token
# In development ACCESS_TOKEN_EXPIRE_MINUTES can stay high, but never in production.
ACCESS_TOKEN_EXPIRE_MINUTES  = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES",  "60"))   # 1 hour
REFRESH_TOKEN_EXPIRE_DAYS    = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS",    "7"))    # 7 days

pwd_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto",
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth-multi/login"
)


# ======================
# PASSWORD HASHING
# ======================
def hash_password(password: str) -> str:
    if not password:
        raise HTTPException(status_code=400, detail="Password cannot be empty")
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    if not plain:
        return False
    return pwd_context.verify(plain, hashed)


# ======================
# TOKEN CREATION
# ======================
def create_access_token(data: dict) -> str:
    """
    Short-lived access token (default 1 hour, set via ACCESS_TOKEN_EXPIRE_MINUTES in .env).
    """
    to_encode = data.copy()
    expire    = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """
    Long-lived refresh token (default 7 days, set via REFRESH_TOKEN_EXPIRE_DAYS in .env).
    Used to get a new access token without re-logging in.

    Usage in login endpoint:
        access  = create_access_token({"sub": user.username})
        refresh = create_refresh_token({"sub": user.username})
        return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}
    """
    to_encode = data.copy()
    expire    = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_refresh_token(token: str) -> str:
    """
    Validate a refresh token and return the username.
    Raises HTTPException on invalid/expired token.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        username: str = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Refresh token expired or invalid")


# ======================
# GET CURRENT USER
# ======================
def get_current_user(
    token: str     = Depends(oauth2_scheme),
    db:    Session = Depends(get_db),
) -> User:
    try:
        payload  = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user



