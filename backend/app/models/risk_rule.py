from sqlalchemy import Column, Integer, Float, Boolean, ForeignKey
from app.database.database import Base


class RiskRule(Base):
    __tablename__ = "risk_rules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    daily_loss_limit = Column(Float)
    max_drawdown = Column(Float)
    risk_per_trade = Column(Float)
    min_rr_ratio = Column(Float)

    trailing_dd_enabled = Column(Boolean, default=False)


