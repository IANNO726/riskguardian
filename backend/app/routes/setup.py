from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.broker import BrokerConnection
from app.models.risk_rule import RiskRule
from app.models.alert_setting import AlertSetting
from app.models.ai_setting import AISetting
from app.services.encryption import EncryptionService
from app.services.auth_service import get_current_user
from app.services.mt5_verifier import MT5Verifier
from app.models.user import User

router = APIRouter(tags=["Setup"])


@router.post("/complete")
def complete_setup(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    user_id = current_user.id

    # Prevent duplicate setup
    existing_broker = db.query(BrokerConnection).filter(
        BrokerConnection.user_id == user_id
    ).first()

    if existing_broker:
        raise HTTPException(
            status_code=400,
            detail="Setup already completed"
        )

    # ===============================
    # 🔍 VERIFY MT5 CREDENTIALS
    # ===============================
    account_number = data["broker"]["account_number"]
    password = data["broker"]["password"]
    server = data["broker"]["server"]

    verified, message = MT5Verifier.verify(
        account_number,
        password,
        server
    )

    if not verified:
        raise HTTPException(status_code=400, detail=message)

    # ===============================
    # 🔐 Encrypt Password
    # ===============================
    encryption = EncryptionService()
    encrypted_password = encryption.encrypt(password)

    # ===============================
    # 💼 Save Broker
    # ===============================
    broker = BrokerConnection(
        user_id=user_id,
        broker_name="MT5",
        account_number=account_number,
        server=server,
        encrypted_password=encrypted_password
    )
    db.add(broker)

    # ===============================
    # 📉 Save Risk Rules
    # ===============================
    risk = RiskRule(
        user_id=user_id,
        daily_loss_limit=data["risk"]["daily_loss"],
        max_drawdown=data["risk"]["max_dd"],
        risk_per_trade=data["risk"]["risk_per_trade"],
        min_rr_ratio=data["risk"]["min_rr"]
    )
    db.add(risk)

    # ===============================
    # 📢 Save Alerts
    # ===============================
    alerts = AlertSetting(
        user_id=user_id,
        telegram_enabled=data["alerts"]["telegram"],
        email_enabled=data["alerts"]["email"],
        sms_enabled=data["alerts"]["sms"]
    )
    db.add(alerts)

    # ===============================
    # 🤖 Save AI Settings
    # ===============================
    ai = AISetting(
        user_id=user_id,
        emotional_detection=data["ai"]["emotional"],
        predictive_drawdown=data["ai"]["predictive"],
        risk_optimizer=data["ai"]["optimizer"]
    )
    db.add(ai)

    db.commit()

    return {
        "status": "Setup completed successfully",
        "mt5_verified": True
    }



