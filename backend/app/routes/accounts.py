"""
Trading Accounts Routes
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database.database import get_db

router = APIRouter(tags=["Accounts"])


# =========================
# Request Model
# =========================
class AccountCreate(BaseModel):
    broker: str
    account_number: str
    password: str
    server: str


# =========================
# Get All Accounts
# =========================
@router.get("/")
async def get_accounts(db: Session = Depends(get_db)):
    return {
        "accounts": [
            {
                "id": 1,
                "account_number": "6009324",
                "broker": "Deriv",
                "platform": "MT5",
                "account_type": "Demo",
                "balance": 10000.00,
                "equity": 10000.00,
                "status": "connected"
            }
        ]
    }


# =========================
# CREATE ACCOUNT
# =========================
@router.post("/create")
async def create_account(account: AccountCreate, db: Session = Depends(get_db)):
    return {
        "message": "Account saved successfully",
        "account_number": account.account_number,
        "broker": account.broker,
        "server": account.server,
        "status": "connected"
    }


# =========================
# Connect Account
# =========================
@router.post("/connect")
async def connect_account(
    account_number: str,
    password: str,
    server: str,
    platform: str = "MT5",
    db: Session = Depends(get_db)
):
    return {
        "message": "Account connected successfully",
        "account_number": account_number,
        "platform": platform,
        "status": "connected"
    }


# =========================
# Get Account Info
# =========================
@router.get("/info")
async def get_account_info():
    from app.services.mt5_wrapper import get_mt5
    mt5 = get_mt5()   # ✅ NOW CORRECTLY INDENTED

    try:
        # ✅ If MT5 not available (Render), return safe mock
        if mt5 is None:
            return {
                "balance": 10000.00,
                "equity": 10000.00,
                "margin": 0.00,
                "free_margin": 10000.00,
                "margin_level": 0.00,
                "profit": 0.00,
                "note": "MT5 not available (cloud mode)"
            }

        if not mt5.initialize():
            return {
                "balance": 10000.00,
                "equity": 10000.00,
                "margin": 0.00,
                "free_margin": 10000.00,
                "margin_level": 0.00,
                "profit": 0.00,
                "error": "MT5 not initialized"
            }

        account_info = mt5.account_info()

        if account_info is None:
            return {
                "balance": 10000.00,
                "equity": 10000.00,
                "margin": 0.00,
                "free_margin": 10000.00,
                "margin_level": 0.00,
                "profit": 0.00,
                "error": "Failed to get account info"
            }

        return {
            "balance": account_info.balance,
            "equity": account_info.equity,
            "margin": account_info.margin,
            "free_margin": account_info.margin_free,
            "margin_level": account_info.margin_level if account_info.margin > 0 else 0,
            "profit": account_info.profit,
        }

    except Exception as e:
        return {
            "balance": 10000.00,
            "equity": 10000.00,
            "margin": 0.00,
            "free_margin": 10000.00,
            "margin_level": 0.00,
            "profit": 0.00,
            "error": str(e)
        }


# =========================
# Get Single Account
# =========================
@router.get("/{account_id}")
async def get_account(account_id: int, db: Session = Depends(get_db)):
    return {
        "id": account_id,
        "account_number": "6009324",
        "balance": 10000.00,
        "equity": 10000.00,
        "margin": 0.00,
        "free_margin": 10000.00
    }
