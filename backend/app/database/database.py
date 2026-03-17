from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool

# DATABASE CONNECTION
DATABASE_URL = "sqlite:///./riskguardian.db"

# ✅ StaticPool — single connection, no pool timeout errors with SQLite
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# SESSION
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# BASE MODEL
Base = declarative_base()

# DATABASE SESSION DEPENDENCY
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# IMPORT ALL MODELS HERE
# (VERY IMPORTANT so SQLAlchemy knows what tables to create)
import app.models.admin_models

# INITIALIZE DATABASE
async def init_db():
    Base.metadata.create_all(bind=engine)
