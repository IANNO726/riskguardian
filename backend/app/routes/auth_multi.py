"""
Multi-User Authentication Routes
JWT-based authentication with user registration and login
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import JWTError, jwt
from typing import Optional
import os

from app.database.database import get_db
from app.models.user import User
from app.utils.encryption import hash_user_password, verify_user_password
from pydantic import BaseModel, EmailStr

router = APIRouter(tags=["Multi-User Authentication"])

# JWT Settings
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production-12345")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth-multi/login")

# ==================== SCHEMAS ====================

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str]
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# ==================== HELPER FUNCTIONS ====================

def create_access_token(data: dict):
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Get current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

# ==================== ROUTES ====================

@router.post("/register", response_model=Token)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user
    Returns JWT token for immediate login
    """
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(
            status_code=400, 
            detail="Username already exists. Please choose a different username."
        )
    
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=400, 
            detail="Email already registered. Please use a different email or login."
        )
    
    hashed_password = hash_user_password(user_data.password)
    user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        last_login=datetime.utcnow()
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    access_token = create_access_token(data={"sub": user.username})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

# 🔥 FIXED LOGIN (supports JSON + form)
@router.post("/login", response_model=Token)
async def login(request: Request, db: Session = Depends(get_db)):
    """
    Login user (supports BOTH JSON and form-data)
    """

    content_type = request.headers.get("content-type", "")

    # ===== JSON (React) =====
    if "application/json" in content_type:
        data = await request.json()
        username = data.get("username")
        password = data.get("password")

    # ===== FORM (Swagger) =====
    else:
        form = await request.form()
        username = form.get("username")
        password = form.get("password")

    # ===== VALIDATION =====
    if not username or not password:
        raise HTTPException(
            status_code=400,
            detail="Username and password are required"
        )

    user = db.query(User).filter(User.username == username).first()

    if not user or not verify_user_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Please contact support."
        )
    
    user.last_login = datetime.utcnow()
    db.commit()
    
    access_token = create_access_token(data={"sub": user.username})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/logout")
async def logout():
    return {"message": "Successfully logged out. Please delete your access token."}



