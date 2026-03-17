from sqlalchemy import Column, Integer, Boolean, ForeignKey
from app.database.database import Base


class AISetting(Base):
    __tablename__ = "ai_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    emotional_detection = Column(Boolean, default=True)
    predictive_drawdown = Column(Boolean, default=True)
    risk_optimizer = Column(Boolean, default=True)