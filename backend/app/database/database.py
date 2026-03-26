import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool, NullPool

# ── Database URL ──────────────────────────────────────────────────────────────
# On Render:  set DATABASE_URL env var to your PostgreSQL Internal Database URL
# Locally:    falls back to SQLite for development
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./riskguardian.db")

# Render gives Postgres URLs starting with "postgres://" but SQLAlchemy
# requires "postgresql://" — fix it automatically
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# ── Engine ────────────────────────────────────────────────────────────────────
if DATABASE_URL.startswith("sqlite"):
    # Local development — SQLite
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    # Production — PostgreSQL on Render (NullPool avoids connection timeouts)
    engine = create_engine(
        DATABASE_URL,
        poolclass=NullPool,
    )

# ── Session ───────────────────────────────────────────────────────────────────
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# ── Base model ────────────────────────────────────────────────────────────────
Base = declarative_base()

# ── DB session dependency (used in every route) ───────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ── Import ALL models so create_all knows every table ────────────────────────
import app.models.admin_models
import app.models.broker          # BrokerConnection
import app.models.user            # User, TradingAccount, Subscription
import app.models.risk_rule       # RiskRule
import app.models.alert_setting   # AlertSetting
import app.models.ai_setting      # AISetting
import app.models.journal         # JournalEntry

# ── Initialize database ───────────────────────────────────────────────────────
async def init_db():
    Base.metadata.create_all(bind=engine)
    db_type = "PostgreSQL" if not DATABASE_URL.startswith("sqlite") else "SQLite (local)"
    print(f"✅ Database initialized: {db_type}")



