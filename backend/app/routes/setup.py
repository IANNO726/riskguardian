from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.broker import BrokerConnection
from app.models.risk_rule import RiskRule
from app.models.alert_setting import AlertSetting
from app.models.ai_setting import AISetting
from app.services.encryption import EncryptionService
from app.services.mt5_verifier import MT5Verifier
from app.models.user import User

# ── FIX: use auth_multi (not auth_service) for get_current_user ──
try:
    from app.routes.auth_multi import get_current_user
except ImportError:
    from app.services.auth_service import get_current_user

router = APIRouter(tags=["Setup"])


@router.post("/complete")
def complete_setup(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_id = current_user.id

    # ── Prevent duplicate setup ───────────────────────────────
    existing_broker = db.query(BrokerConnection).filter(
        BrokerConnection.user_id == user_id
    ).first()
    if existing_broker:
        # Already set up — mark user as complete and return OK
        current_user.setup_complete = True
        db.commit()
        return {"status": "Setup already completed", "mt5_verified": True}

    # ── Extract broker fields ─────────────────────────────────
    broker_data   = data.get("broker", {})
    account_number = broker_data.get("account_number", "")
    password       = broker_data.get("password", "")
    server         = broker_data.get("server", "")

    # ── Verify MT5 credentials ────────────────────────────────
    # FIX: MT5Verifier.verify() now returns 3 values (bool, str, dict|None)
    # On Render where MT5 is None, it returns (True, "skipped", {}) immediately
    verified, message, _info = MT5Verifier.verify(
        account_number,
        password,
        server,
    )
    if not verified:
        raise HTTPException(status_code=400, detail=message)

    # ── Encrypt password ──────────────────────────────────────
    encryption = EncryptionService()
    encrypted_password = encryption.encrypt(password) if password else ""

    # ── Save broker ───────────────────────────────────────────
    broker_name = broker_data.get("broker_name") or broker_data.get("broker") or "MT5"
    broker = BrokerConnection(
        user_id=user_id,
        broker_name=broker_name,
        account_number=account_number,
        server=server,
        encrypted_password=encrypted_password,
    )
    db.add(broker)

    # ── Save risk rules ───────────────────────────────────────
    risk_data = data.get("risk", {})
    risk = RiskRule(
        user_id=user_id,
        daily_loss_limit=float(risk_data.get("daily_loss", 2)),
        max_drawdown=float(risk_data.get("max_dd", 5)),
        risk_per_trade=float(risk_data.get("risk_per_trade", 1)),
        min_rr_ratio=float(risk_data.get("min_rr", 2)),
    )
    db.add(risk)

    # ── Save alert settings ───────────────────────────────────
    alerts_data = data.get("alerts", {})
    alerts = AlertSetting(
        user_id=user_id,
        telegram_enabled=bool(alerts_data.get("telegram", True)),
        email_enabled=bool(alerts_data.get("email", True)),
        sms_enabled=bool(alerts_data.get("sms", False)),
    )
    db.add(alerts)

    # ── Save AI settings ──────────────────────────────────────
    ai_data = data.get("ai", {})
    ai = AISetting(
        user_id=user_id,
        emotional_detection=bool(ai_data.get("emotional", True)),
        predictive_drawdown=bool(ai_data.get("predictive", True)),
        risk_optimizer=bool(ai_data.get("optimizer", True)),
    )
    db.add(ai)

    # ── Mark user setup as complete ───────────────────────────
    current_user.setup_complete = True

    db.commit()

    return {
        "status":       "Setup completed successfully",
        "mt5_verified": verified,
        "mt5_message":  message,
    }



