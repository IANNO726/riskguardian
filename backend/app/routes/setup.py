"""
Setup Routes — saves to TradingAccount (used by accounts_multi.py)
===================================================================
Critical fix: setup wizard must save to TradingAccount, NOT BrokerConnection.
accounts_multi.py reads from TradingAccount — that's what useLiveTrades polls.
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
    existing = db.query(TradingAccount).filter_by(
        user_id=user_id
    ).first()
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
    ).strip()
    broker_lower   = broker_name.lower()

    account_number = broker_data.get("account_number", "").strip()
    password       = broker_data.get("password", "").strip()
    server         = broker_data.get("server", "").strip()

    # ── Validate + verify per broker type ────────────────────────────────
    is_deriv = "deriv" in broker_lower or broker_lower in DERIV_NAMES
    is_oanda = broker_lower in OANDA_NAMES

    last_balance   = 0.0
    last_equity    = 0.0
    currency       = "USD"
    last_connected = None
    verified       = True
    message        = "Saved"

    if is_deriv:
        if not password:
            raise HTTPException(
                status_code=400,
                detail="Deriv API token is required. Get it at app.deriv.com → Account Settings → API Token"
            )
        # Verify the Deriv API token via WebSocket
        verified, message, info = await DerivVerifier.verify(password)
        if not verified:
            raise HTTPException(status_code=400, detail=f"Deriv verification failed: {message}")
        if info:
            last_balance   = float(info.get("balance",  0))
            last_equity    = float(info.get("equity",   0))
            currency       = info.get("currency", "USD")
            last_connected = datetime.utcnow()
            # Use the real loginid Deriv returned
            if info.get("login"):
                account_number = str(info["login"])

        server   = server or "deriv-server"
        platform = PlatformType.MT5   # Deriv uses MT5 platform type

    elif is_oanda:
        if not password:
            raise HTTPException(
                status_code=400,
                detail="OANDA API token is required."
            )
        if not account_number:
            raise HTTPException(
                status_code=400,
                detail="OANDA Account ID is required (e.g. 101-001-1234567-001)"
            )
        server   = server or "oanda"
        platform = PlatformType.MT5

    else:
        # MT5 broker — verify credentials
        # MT5Verifier returns (True, "skipped", {}) on Render/Linux
        verified, message, info = MT5Verifier.verify(
            account_number, password, server
        )
        if not verified:
            raise HTTPException(status_code=400, detail=message)
        if info:
            last_balance   = float(info.get("balance",  0))
            last_equity    = float(info.get("equity",   0))
            currency       = info.get("currency", "USD")
            last_connected = datetime.utcnow()
        platform = PlatformType.MT5

    # ── Save to TradingAccount (what accounts_multi.py reads) ─────────────
    account = TradingAccount(
        user_id            = user_id,
        platform           = platform,
        account_number     = account_number,
        broker_name        = broker_name,
        server             = server,
        encrypted_password = encrypt_password(password),
        account_name       = f"{broker_name} - {account_number}",
        is_default         = True,
        last_balance       = last_balance,
        last_equity        = last_equity,
        currency           = currency,
        last_connected     = last_connected,
    )
    db.add(account)

    # ── Save risk rules ───────────────────────────────────────────────────
    risk_data = data.get("risk", {})
    db.add(RiskRule(
        user_id          = user_id,
        daily_loss_limit = float(risk_data.get("daily_loss",    2)),
        max_drawdown     = float(risk_data.get("max_dd",        5)),
        risk_per_trade   = float(risk_data.get("risk_per_trade",1)),
        min_rr_ratio     = float(risk_data.get("min_rr",        2)),
    ))

    # ── Save alert settings ───────────────────────────────────────────────
    alerts_data = data.get("alerts", {})
    db.add(AlertSetting(
        user_id          = user_id,
        telegram_enabled = bool(alerts_data.get("telegram", True)),
        email_enabled    = bool(alerts_data.get("email",    True)),
        sms_enabled      = bool(alerts_data.get("sms",      False)),
    ))

    # ── Save AI settings ──────────────────────────────────────────────────
    ai_data = data.get("ai", {})
    db.add(AISetting(
        user_id             = user_id,
        emotional_detection = bool(ai_data.get("emotional",  True)),
        predictive_drawdown = bool(ai_data.get("predictive", True)),
        risk_optimizer      = bool(ai_data.get("optimizer",  True)),
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



