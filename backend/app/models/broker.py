from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from app.database.database import Base


class BrokerConnection(Base):
    __tablename__ = "broker_connections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    broker_name = Column(String, default="MT5")
    account_number = Column(String)
    server = Column(String)

    encrypted_password = Column(String)

    is_active = Column(Boolean, default=True)


