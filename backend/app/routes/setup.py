"""
Setup Routes — Multi-Broker SaaS
==================================
Deriv users provide 3 fields:
  1. api_token      → Deriv API token (for WebSocket balance display)
  2. mt5_login      → MT5 numeric login (e.g. 40979584)
  3. mt5_password   → MT5 password

These are stored separately in TradingAccount:
  - account_number     = MT5 numeric login
  - encrypted_password = encrypted MT5 password
  - api_token          = encrypted Deriv API token

This way every user has their own credentials — no shared env vars.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.database.database import get_db
from app.models.user import User, TradingAccount, PlatformType
from app.models.risk_rule import RiskRule
from app.models.alert_setting import AlertSetting
from app.models.ai_setting import AISetting
from app.routes.auth_multi import get_current_user
from app.utils.encryption import encrypt_password
from app.platforms.deriv_adapter import DerivVerifier
from app.services.mt5_verifier import MT5Verifier

router = APIRouter(tags=["Setup"])

DERIV_NAMES = {"deriv", "binary", "binary.com", "deriv.com"}
OANDA_NAMES = {"oanda", "oanda.com"}


@router.post("/complete")
async def complete_setup(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_id = current_user.id

    # ── Prevent duplicate setup ───────────────────────────────────────────
    existing = db.query(TradingAccount).filter_by(user_id=user_id).first()
    if existing:
        current_user.setup_complete = True
        db.commit()
        return {"status": "Setup already completed", "mt5_verified": True}

    # ── Extract broker fields ─────────────────────────────────────────────
    broker_data  = data.get("broker", {})
    broker_name  = (
        broker_data.get("broker_name") or
        broker_data.get("broker") or
        "MT5"
    ).strip()
    broker_lower = broker_name.lower()

    is_deriv = "deriv" in broker_lower or broker_lower in DERIV_NAMES
    is_oanda = broker_lower in OANDA_NAMES

    last_balance   = 0.0
    last_equity    = 0.0
    currency       = "USD"
    last_connected = None
    verified       = True
    message        = "Saved"
    encrypted_api_token = None

    if is_deriv:
        # ── Deriv: 3 separate fields ──────────────────────────────────────
        api_token    = broker_data.get("api_token",    "").strip()
        mt5_login    = broker_data.get("mt5_login",    "").strip()
        mt5_password = broker_data.get("mt5_password", "").strip()
        server       = broker_data.get("server", "Deriv-Demo").strip() or "Deriv-Demo"

        # Also support old single-field format (password = api token)
        if not api_token:
            api_token = broker_data.get("password", "").strip()

        if not api_token:
            raise HTTPException(
                status_code=400,
                detail="Deriv API token is required. Get it at app.deriv.com → Account Settings → API Token"
            )
        if not mt5_login:
            raise HTTPException(
                status_code=400,
                detail="MT5 Login Number is required (e.g. 40979584). Find it in your Deriv MT5 terminal."
            )
        if not mt5_password:
            raise HTTPException(
                status_code=400,
                detail="MT5 Password is required. This is your Deriv MT5 account password."
            )

        # Verify Deriv API token via WebSocket
        verified, message, info = await DerivVerifier.verify(api_token)
        if not verified:
            raise HTTPException(status_code=400, detail=f"Deriv verification failed: {message}")

        if info:
            last_balance   = float(info.get("balance",  0))
            last_equity    = float(info.get("equity",   0))
            currency       = info.get("currency", "USD")
            last_connected = datetime.utcnow()

        # Store all 3 credentials
        account_number      = mt5_login                       # MT5 numeric login
        encrypted_password  = encrypt_password(mt5_password)  # MT5 password
        encrypted_api_token = encrypt_password(api_token)     # Deriv API token
        platform            = PlatformType.MT5

    elif is_oanda:
        api_token      = broker_data.get("api_token", "") or broker_data.get("password", "")
        account_number = broker_data.get("account_number", "").strip()
        server         = broker_data.get("server", "oanda").strip() or "oanda"

        if not api_token:
            raise HTTPException(status_code=400, detail="OANDA API token is required.")
        if not account_number:
            raise HTTPException(status_code=400, detail="OANDA Account ID is required.")

        encrypted_password  = encrypt_password(api_token)
        encrypted_api_token = encrypt_password(api_token)
        platform            = PlatformType.MT5

    else:
        # ── MT5 broker ────────────────────────────────────────────────────
        account_number = broker_data.get("account_number", "").strip()
        password       = broker_data.get("password", "").strip()
        server         = broker_data.get("server", "").strip()

        verified, message, info = MT5Verifier.verify(account_number, password, server)
        if not verified:
            raise HTTPException(status_code=400, detail=message)
        if info:
            last_balance   = float(info.get("balance",  0))
            last_equity    = float(info.get("equity",   0))
            currency       = info.get("currency", "USD")
            last_connected = datetime.utcnow()

        encrypted_password = encrypt_password(password)
        platform           = PlatformType.MT5

    # ── Save TradingAccount ───────────────────────────────────────────────
    account = TradingAccount(
        user_id            = user_id,
        platform           = platform,
        account_number     = account_number,
        broker_name        = broker_name,
        server             = server,
        encrypted_password = encrypted_password,
        api_token          = encrypted_api_token,   # Deriv API token (None for non-Deriv)
        account_name       = f"{broker_name} - {account_number}",
        is_default         = True,
        last_balance       = last_balance,
        last_equity        = last_equity,
        currency           = currency,
        last_connected     = last_connected,
    )
    db.add(account)

    # ── Risk rules ────────────────────────────────────────────────────────
    risk_data = data.get("risk", {})
    db.add(RiskRule(
        user_id          = user_id,
        daily_loss_limit = float(risk_data.get("daily_loss",    2)),
        max_drawdown     = float(risk_data.get("max_dd",        5)),
        risk_per_trade   = float(risk_data.get("risk_per_trade",1)),
        min_rr_ratio     = float(risk_data.get("min_rr",        2)),
    ))

    # ── Alert settings ────────────────────────────────────────────────────
    alerts_data = data.get("alerts", {})
    db.add(AlertSetting(
        user_id          = user_id,
        telegram_enabled = bool(alerts_data.get("telegram", True)),
        email_enabled    = bool(alerts_data.get("email",    True)),
        sms_enabled      = bool(alerts_data.get("sms",      False)),
    ))

    # ── AI settings ───────────────────────────────────────────────────────
    ai_data = data.get("ai", {})
    db.add(AISetting(
        user_id             = user_id,
        emotional_detection = bool(ai_data.get("emotional",  True)),
        predictive_drawdown = bool(ai_data.get("predictive", True)),
        risk_optimizer      = bool(ai_data.get("optimizer",  True)),
    ))

    current_user.setup_complete = True
    db.commit()

    return {
        "status":       "Setup completed successfully",
        "broker":       broker_name,
        "mt5_verified": verified,
        "mt5_message":  message,
    }


@router.delete("/reset-my-account")
async def reset_setup(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reset setup so user can re-run the wizard with new credentials."""
    deleted = db.query(TradingAccount).filter_by(user_id=current_user.id).delete()
    current_user.setup_complete = False
    db.commit()
    return {"message": f"Reset complete. Deleted {deleted} accounts. Please run setup again."}



