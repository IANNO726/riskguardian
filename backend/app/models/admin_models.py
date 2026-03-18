from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime
from app.database.database import Base


class Visitor(Base):
    __tablename__ = "visitors"

    id = Column(Integer, primary_key=True, index=True)
    ip_address = Column(String)
    country = Column(String)
    page = Column(String)
    device = Column(String)
    visited_at = Column(DateTime, default=datetime.utcnow)


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    action = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class PlatformMetrics(Base):
    __tablename__ = "platform_metrics"

    id = Column(Integer, primary_key=True, index=True)
    total_users = Column(Integer, default=0)
    active_users = Column(Integer, default=0)
    trades_today = Column(Integer, default=0)
    revenue_today = Column(Integer, default=0)
    visitors_today = Column(Integer, default=0)



