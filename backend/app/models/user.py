"""
User and Trading Account Models
Multi-user, multi-account support with Stripe subscription

CHANGE 8 (plan_gating):
  8a — GROWTH added to PlanType enum between PRO and ENTERPRISE
  8b — Subscription.plan is a String column — no migration needed.

CHANGE 9 (deriv_saas):
  9a — TradingAccount.api_token added for Deriv API token storage
       (separate from encrypted_password which stores MT5 password)
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database.database import Base


class PlatformType(enum.Enum):
    MT5     = "MT5"
    MT4     = "MT4"
    CTRADER = "cTrader"


class PlanType(enum.Enum):
    FREE       = "free"
    STARTER    = "starter"
    PRO        = "pro"
    GROWTH     = "growth"
    ENTERPRISE = "enterprise"


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String, unique=True, index=True, nullable=False)
    email           = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name       = Column(String)
    is_active       = Column(Boolean, default=True)
    setup_complete  = Column(Boolean, default=False)
    created_at      = Column(DateTime, default=datetime.utcnow)
    last_login      = Column(DateTime)

    plan                   = Column(String, default="free")
    subscription_status    = Column(String, default="inactive")
    stripe_customer_id     = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True)
    plan_expires_at        = Column(DateTime, nullable=True)

    trial_ends_at          = Column(DateTime, nullable=True)
    trial_used             = Column(Boolean, default=False)
    trial_plan             = Column(String, default="pro", nullable=True)

    email_welcome_sent     = Column(Boolean, default=False)
    email_day3_sent        = Column(Boolean, default=False)
    email_day7_sent        = Column(Boolean, default=False)
    email_unsubscribed     = Column(Boolean, default=False)

    telegram_chat_id       = Column(String, nullable=True)

    trading_accounts = relationship("TradingAccount", back_populates="user",  cascade="all, delete-orphan")
    journal_entries  = relationship("JournalEntry",   back_populates="user",  cascade="all, delete-orphan")
    subscription     = relationship("Subscription",   back_populates="user",  cascade="all, delete-orphan", uselist=False)


class TradingAccount(Base):
    __tablename__ = "trading_accounts"

    id      = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    platform       = Column(Enum(PlatformType), nullable=False)
    account_number = Column(String, nullable=False)   # MT5 numeric login (e.g. 40979584)
    broker_name    = Column(String, nullable=False)
    server         = Column(String, nullable=False)
    account_name   = Column(String)

    encrypted_password = Column(String, nullable=False)  # MT5 password (encrypted)

    # CHANGE 9a: Deriv API token stored separately (encrypted)
    # Used for WebSocket auth — different from MT5 password
    api_token      = Column(String, nullable=True)       # Deriv API token (encrypted)

    is_active      = Column(Boolean, default=True)
    is_default     = Column(Boolean, default=False)
    last_connected = Column(DateTime)

    last_balance = Column(Float, default=0.0)
    last_equity  = Column(Float, default=0.0)
    currency     = Column(String, default="USD")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="trading_accounts")

    class Config:
        orm_mode = True


class Subscription(Base):
    """Tracks full Stripe subscription history per user."""
    __tablename__ = "subscriptions"

    id                     = Column(Integer, primary_key=True, index=True)
    user_id                = Column(Integer, ForeignKey("users.id"), nullable=False)
    stripe_subscription_id = Column(String, unique=True, nullable=False)
    stripe_customer_id     = Column(String, nullable=False)
    plan                   = Column(String, nullable=False)
    status                 = Column(String, default="active")
    current_period_start   = Column(DateTime, nullable=True)
    current_period_end     = Column(DateTime, nullable=True)
    canceled_at            = Column(DateTime, nullable=True)
    created_at             = Column(DateTime, default=datetime.utcnow)
    updated_at             = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="subscription")


