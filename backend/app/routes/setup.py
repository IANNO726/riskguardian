"""
Setup Routes — Multi-Broker Aware
===================================
Saves broker credentials correctly for Deriv, OANDA, and MT5 brokers.
Deriv/OANDA users store their API token in encrypted_password.
MT5 users store their MT5 password in encrypted_password.
"""
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

try:
    from app.routes.auth_multi import get_current_user
except ImportError:
    from app.services.auth_service import get_current_user

router = APIRouter(tags=["Setup"])

DERIV_NAMES = {"deriv", "binary", "binary.com", "deriv.com"}
OANDA_NAMES = {"oanda", "oanda.com"}


@router.post("/complete")
def complete_setup(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_id = current_user.id

    # ── Prevent duplicate setup ───────────────────────────────────────────
    existing = db.query(BrokerConnection).filter_by(user_id=user_id).first()
    if existing:
        current_user.setup_complete = True
        db.commit()
        return {"status": "Setup already completed", "mt5_verified": True}

    # ── Extract broker fields ─────────────────────────────────────────────
    broker_data    = data.get("broker", {})
    broker_name    = (
        broker_data.get("broker_name") or
        broker_data.get("broker") or
        "MT5"
    ).lower().strip()

    account_number = broker_data.get("account_number", "").strip()
    password       = broker_data.get("password", "").strip()   # token OR MT5 password
    server         = broker_data.get("server", "").strip()

    # ── Validate required fields per broker type ──────────────────────────
    if broker_name in DERIV_NAMES:
        if not password:
            raise HTTPException(
                status_code=400,
                detail="Deriv API token is required. Get it at app.deriv.com → Account Settings → API Token"
            )
        # Skip MT5 verification for Deriv
        verified = True
        message  = "Deriv API token saved"

    elif broker_name in OANDA_NAMES:
        if not password:
            raise HTTPException(
                status_code=400,
                detail="OANDA API token is required. Get it at OANDA Account Management → My Services → Manage API Access"
            )
        if not account_number:
            raise HTTPException(
                status_code=400,
                detail="OANDA Account ID is required (e.g. 101-001-1234567-001)"
            )
        # Skip MT5 verification for OANDA
        verified = True
        message  = "OANDA API token saved"

    else:
        # ── MT5 broker — verify credentials ──────────────────────────────
        # MT5Verifier returns (True, "skipped", {}) on Render/Linux
        verified, message, _info = MT5Verifier.verify(
            account_number, password, server
        )
        if not verified:
            raise HTTPException(status_code=400, detail=message)

    # ── Encrypt the credential (token or MT5 password) ────────────────────
    encryption = EncryptionService()
    encrypted  = encryption.encrypt(password) if password else ""

    # ── Save BrokerConnection ─────────────────────────────────────────────
    broker = BrokerConnection(
        user_id=user_id,
        broker_name=broker_name,
        account_number=account_number,
        server=server,
        encrypted_password=encrypted,
    )
    db.add(broker)

    # ── Save risk rules ───────────────────────────────────────────────────
    risk_data = data.get("risk", {})
    db.add(RiskRule(
        user_id=user_id,
        daily_loss_limit=float(risk_data.get("daily_loss",    2)),
        max_drawdown=    float(risk_data.get("max_dd",        5)),
        risk_per_trade=  float(risk_data.get("risk_per_trade",1)),
        min_rr_ratio=    float(risk_data.get("min_rr",        2)),
    ))

    # ── Save alert settings ───────────────────────────────────────────────
    alerts_data = data.get("alerts", {})
    db.add(AlertSetting(
        user_id=user_id,
        telegram_enabled=bool(alerts_data.get("telegram", True)),
        email_enabled=   bool(alerts_data.get("email",    True)),
        sms_enabled=     bool(alerts_data.get("sms",      False)),
    ))

    # ── Save AI settings ──────────────────────────────────────────────────
    ai_data = data.get("ai", {})
    db.add(AISetting(
        user_id=user_id,
        emotional_detection=bool(ai_data.get("emotional",  True)),
        predictive_drawdown=bool(ai_data.get("predictive", True)),
        risk_optimizer=     bool(ai_data.get("optimizer",  True)),
    ))

    # ── Mark user setup complete ──────────────────────────────────────────
    current_user.setup_complete = True
    db.commit()

    return {
        "status":       "Setup completed successfully",
        "broker":       broker_name,
        "mt5_verified": verified,
        "mt5_message":  message,
    }



