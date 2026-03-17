"""
Multi-Account Trading Routes
============================
KEY FIX: Expanded Deriv detection — catches ALL Deriv server/broker variants.
Deriv accounts → DerivAdapter (WebSocket, instant, no MT5 disconnections)
MT5 accounts   → MT5Adapter  (FTMO, Exness, IC Markets, EGM, etc.)

Smooth account switching:
  - Deriv accounts never touch MT5 terminal → zero disconnections
  - MT5 accounts use thread-safe sequential connections

CHANGE 6 (plan_gating): PLAN_ACCOUNT_LIMITS replaced with check_account_limit()
from app.middleware.plan_gating — single source of truth for account limits.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.database.database import get_db
from app.models.user import User, TradingAccount, PlatformType
from app.routes.auth_multi import get_current_user
from app.utils.encryption import encrypt_password, decrypt_password
from app.platforms.mt5_adapter import MT5Adapter, MT5Verifier
from app.platforms.deriv_adapter import DerivAdapter, DerivVerifier
from app.middleware.plan_gating import check_account_limit

router = APIRouter(tags=["Multi-Account Management"])

# ── ALL Deriv server/broker patterns ────────────────────────
# Any account matching these goes to DerivAdapter (WebSocket)
# and NEVER touches the MT5 terminal
DERIV_PATTERNS = {
    # Server name patterns
    "deriv-demo", "deriv-server", "deriv-real",
    "derivsvg-server", "derivsvg-demo",
    "derivmx-server", "derivmx-demo",
    "deriv.com",
}


def _is_deriv(account: TradingAccount) -> bool:
    """
    Returns True for ANY Deriv account — by server name or broker name.
    These accounts use WebSocket API, not MT5 terminal.
    """
    server = (account.server or "").lower().strip().replace(" ", "")
    broker = (account.broker_name or "").lower().strip()

    # Match server patterns
    if any(p in server for p in DERIV_PATTERNS):
        return True
    # Match broker name containing "deriv"
    if "deriv" in broker:
        return True
    return False


def _is_deriv_from_form(broker_name: str, server: str) -> bool:
    """Same check but from raw form strings (before DB save)."""
    s = server.lower().strip().replace(" ", "")
    b = broker_name.lower().strip()
    if any(p in s for p in DERIV_PATTERNS):
        return True
    if "deriv" in b:
        return True
    return False


# ==================== SCHEMAS ====================

class AccountCreate(BaseModel):
    platform: str
    account_number: str  # Deriv: loginid (CR/VRTC) | MT5: numeric login
    broker_name: str
    server: str
    password: str        # Deriv: API token | MT5: password
    account_name: Optional[str] = None

class AccountResponse(BaseModel):
    id: int
    platform: str
    account_number: str
    broker_name: str
    server: str
    account_name: Optional[str]
    is_active: bool
    is_default: bool
    last_balance: float
    last_equity: float
    currency: str
    last_connected: Optional[datetime]
    class Config:
        from_attributes = True

class AccountUpdate(BaseModel):
    account_name: Optional[str] = None
    is_active: Optional[bool] = None

# ==================== ADAPTER FACTORY ====================

def get_adapter(account: TradingAccount):
    """
    Routes to the correct adapter:
    - Deriv accounts → DerivAdapter (WebSocket, no MT5 terminal needed)
    - All others     → MT5Adapter
    """
    creds = {
        "login":          account.account_number,
        "account_number": account.account_number,
        "password":       decrypt_password(account.encrypted_password),
        "server":         account.server,
    }
    if _is_deriv(account):
        logger.info(f"Routing account {account.account_number} → DerivAdapter (WebSocket)")
        return DerivAdapter(creds)
    logger.info(f"Routing account {account.account_number} → MT5Adapter")
    return MT5Adapter(creds)

import logging
logger = logging.getLogger(__name__)

# ==================== ROUTES ====================

@router.post("/", response_model=AccountResponse)
async def add_trading_account(
    account_data: AccountCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # CHANGE 6: use check_account_limit() from plan_gating instead of
    # the old inline PLAN_ACCOUNT_LIMITS dict — single source of truth.
    check_account_limit(current_user, db)

    try:
        platform_enum = PlatformType[account_data.platform.upper()]
    except KeyError:
        raise HTTPException(status_code=400, detail="Invalid platform. Use MT5, MT4, or CTRADER.")

    is_deriv = _is_deriv_from_form(account_data.broker_name, account_data.server)
    last_balance, last_equity, currency, last_connected = 0.0, 0.0, "USD", None

    if is_deriv:
        # Verify Deriv API token via WebSocket
        success, message, info = await DerivVerifier.verify(account_data.password)
        if not success:
            raise HTTPException(status_code=400, detail=f"Deriv verification failed: {message}")
        if info:
            last_balance   = info.get("balance",  0.0)
            last_equity    = info.get("equity",   0.0)
            currency       = info.get("currency", "USD")
            last_connected = datetime.utcnow()
            # Use the real loginid returned from Deriv
            if info.get("login"):
                account_data.account_number = str(info["login"])

    elif platform_enum == PlatformType.MT5:
        # Verify via MT5 terminal
        success, message, info = MT5Verifier.verify(
            account_number=int(account_data.account_number),
            password=account_data.password,
            server=account_data.server,
        )
        if not success:
            raise HTTPException(status_code=400, detail=f"MT5 verification failed: {message}")
        if info:
            last_balance   = info.get("balance",  0.0)
            last_equity    = info.get("equity",   0.0)
            currency       = info.get("currency", "USD")
            last_connected = datetime.utcnow()

    current_count = db.query(TradingAccount).filter(
        TradingAccount.user_id == current_user.id,
        TradingAccount.is_active == True
    ).count()

    account = TradingAccount(
        user_id            = current_user.id,
        platform           = platform_enum,
        account_number     = account_data.account_number,
        broker_name        = account_data.broker_name,
        server             = account_data.server,
        encrypted_password = encrypt_password(account_data.password),
        account_name       = account_data.account_name
                             or f"{account_data.broker_name} - {account_data.account_number}",
        is_default         = current_count == 0,
        last_balance       = last_balance,
        last_equity        = last_equity,
        currency           = currency,
        last_connected     = last_connected,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.get("/plan-limit")
async def get_plan_limit(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # CHANGE 6: read limits from plan_gating's ACCOUNT_LIMITS dict
    # so /plan-limit always reflects the same numbers as the enforcement.
    from app.middleware.plan_gating import ACCOUNT_LIMITS, get_user_plan
    user_plan    = get_user_plan(current_user)
    max_accounts = ACCOUNT_LIMITS.get(user_plan, 1)
    current_count = db.query(TradingAccount).filter(
        TradingAccount.user_id == current_user.id, TradingAccount.is_active == True
    ).count()
    return {
        "plan":            user_plan,
        "used":            current_count,
        "max":             max_accounts,
        "can_add":         current_count < max_accounts,
        "slots_remaining": max(0, max_accounts - current_count),
    }


@router.get("/", response_model=List[AccountResponse])
async def get_all_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(TradingAccount).filter(
        TradingAccount.user_id == current_user.id,
        TradingAccount.is_active == True
    ).order_by(TradingAccount.is_default.desc(), TradingAccount.created_at).all()


@router.get("/default/info")
async def get_default_account_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    account = (
        db.query(TradingAccount).filter(
            TradingAccount.user_id == current_user.id,
            TradingAccount.is_default == True
        ).first()
        or db.query(TradingAccount).filter(
            TradingAccount.user_id == current_user.id,
            TradingAccount.is_active == True
        ).first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="No trading accounts found.")
    return {
        "id":             account.id,
        "account_name":   account.account_name,
        "platform":       account.platform.value,
        "broker_name":    account.broker_name,
        "account_number": account.account_number,
        "last_balance":   account.last_balance,
        "last_equity":    account.last_equity,
        "currency":       account.currency,
        "is_deriv":       _is_deriv(account),
    }


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.get("/{account_id}/live-data")
async def get_account_live_data(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    ✅ Deriv accounts → Deriv WebSocket (instant, no MT5 terminal touched)
    ✅ MT5 accounts   → MT5 terminal (FTMO, Exness, EGM, IC Markets, etc.)
    No cross-account interference. No disconnections.
    """
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    deriv = _is_deriv(account)
    try:
        adapter   = get_adapter(account)
        connected = await adapter.connect()

        if not connected:
            raise HTTPException(status_code=503, detail=(
                f"Could not connect to {'Deriv' if deriv else 'MT5'} "
                f"for account {account.account_number}. "
                + ("Check your Deriv API token (Read + Trading info scopes required)."
                   if deriv else
                   "Ensure MT5 is open and Tools → Options → Expert Advisors → "
                   "uncheck 'Disable algo trading when account changed'.")
            ))

        account_info = await adapter.get_account_info()
        positions    = await adapter.get_open_positions()
        await adapter.disconnect()

        if account_info:
            account.last_balance   = account_info.get("balance",  0)
            account.last_equity    = account_info.get("equity",   0)
            account.currency       = account_info.get("currency", "USD")
            account.last_connected = datetime.utcnow()
            db.commit()

        return {
            "account_info":      account_info,
            "positions":         positions,
            "positions_count":   len(positions),
            "connected_account": account.account_number,
            "platform":          "deriv" if deriv else "mt5",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Live data error: {str(e)}")


@router.get("/{account_id}/history")
async def get_account_history(
    account_id: int, days: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    try:
        adapter = get_adapter(account)
        await adapter.connect()
        history = await adapter.get_trade_history(days=days)
        await adapter.disconnect()
        return {"history": history, "count": len(history), "days": days}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"History error: {str(e)}")


@router.post("/{account_id}/verify")
async def verify_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    password = decrypt_password(account.encrypted_password)
    if _is_deriv(account):
        success, message, info = await DerivVerifier.verify(password)
    else:
        success, message, info = MT5Verifier.verify(
            account_number=int(account.account_number),
            password=password,
            server=account.server,
        )

    if success and info:
        account.last_balance   = info.get("balance",  account.last_balance)
        account.last_equity    = info.get("equity",   account.last_equity)
        account.currency       = info.get("currency", account.currency)
        account.last_connected = datetime.utcnow()
        db.commit()

    return {"verified": success, "message": message, "account_info": info}


@router.post("/{account_id}/set-default")
async def set_default_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(TradingAccount).filter(
        TradingAccount.user_id == current_user.id
    ).update({"is_default": False})

    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    account.is_default = True
    db.commit()
    return {
        "message":      "Default account updated",
        "account_id":   account_id,
        "account_name": account.account_name,
        "is_deriv":     _is_deriv(account),
    }


@router.patch("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: int, account_data: AccountUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account_data.account_name is not None:
        account.account_name = account_data.account_name
    if account_data.is_active is not None:
        account.is_active = account_data.is_active
    account.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}")
async def delete_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    account = db.query(TradingAccount).filter(
        TradingAccount.id == account_id,
        TradingAccount.user_id == current_user.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    name = account.account_name
    db.delete(account)
    db.commit()
    return {"message": f"Account '{name}' deleted", "deleted_account_id": account_id}
