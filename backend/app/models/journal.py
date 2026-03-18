from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database.database import Base


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id               = Column(Integer, primary_key=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=True)
    ticket           = Column(Integer, unique=True, index=True, nullable=True)

    # Dates
    date             = Column(DateTime, default=datetime.utcnow)
    entry_date       = Column(DateTime, nullable=True)
    exit_date        = Column(DateTime, nullable=True)

    # Trade info
    symbol           = Column(String, index=True)
    direction        = Column(String)
    trade_direction  = Column(String, nullable=True)

    # Prices
    entry_price      = Column(Float, nullable=True)
    close_price      = Column(Float, nullable=True)
    exit_price       = Column(Float, nullable=True)
    stop_loss        = Column(Float, nullable=True)
    take_profit      = Column(Float, nullable=True)

    # Sizing / result
    volume           = Column(Float, nullable=True)
    lot_size         = Column(Float, nullable=True)
    result           = Column(Float, nullable=True)
    profit_loss      = Column(Float, nullable=True)

    # Meta
    emotion          = Column(String, nullable=True)
    emotional_state  = Column(String, nullable=True)
    discipline_score = Column(Integer, nullable=True)
    strategy_used    = Column(String, nullable=True)
    notes            = Column(Text, nullable=True)
    lessons_learned  = Column(Text, nullable=True)
    notion_link      = Column(String, nullable=True)
    screenshots      = Column(Text, nullable=True)
    reviewed         = Column(Boolean, default=False)
    ai_feedback      = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", back_populates="journal_entries")



