"""
Trading Accounts Routes — Multi-Broker, DB-backed
===================================================
Fixes:
  1. GET /           returns a plain ARRAY  (useLiveTrades does Array.isArray check)
  2. GET /{id}/live-data  NEW endpoint — what useLiveTrades polls every 6 seconds
"""
import json
import logging
import os
from datetime import datetime

import httpx
import websockets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.security import decrypt_password
from app.database.database import get_db
from app.models.broker import BrokerConnection
from app.models.user import User

router = APIRouter(tags=["Accounts"])
logger = logging.getLogger(__name__)

DERIV_APP_ID   = os.getenv("DERIV_APP_ID", "1089")
OANDA_BASE_URL = os.getenv("OANDA_BASE_URL", "https://api-fxtrade.oanda.com")

DERIV_NAMES = {"deriv", "binary", "binary.com", "deriv.com"}
OANDA_NAMES = {"oanda", "oanda.com"}


# ── Broker live fetch helpers ──────────────────────────────────────────────

def _broker_key(broker: BrokerConnection) -> str:
    return (broker.broker_name or "").lower().strip()


async def _live_deriv(broker: BrokerConnection) -> dict:
    token  = decrypt_password(broker.encrypted_password)
    ws_url = f"wss://ws.binaryws.com/websockets/v3?app_id={DERIV_APP_ID}"
    try:
        async with websockets.connect(ws_url) as ws:
            await ws.send(json.dumps({"authorize": token}))
            resp = json.loads(await ws.recv())
            if "error" in resp:
                raise Exception(resp["error"]["message"])
            auth = resp["authorize"]
            return {
                "balance":      float(auth.get("balance", 0)),
                "equity":       float(auth.get("balance", 0)),
                "profit":       0.0,
                "currency":     auth.get("currency", "USD"),
                "account_name": auth.get("loginid", broker.account_number),
                "connected":    True,
            }
    except Exception as e:
        logger.warning(f"Deriv live fetch failed: {e}")
        return _fallback(broker)


async def _live_oanda(broker: BrokerConnection) -> dict:
    token      = decrypt_password(broker.encrypted_password)
    account_id = broker.account_number
    headers    = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(
            base_url=OANDA_BASE_URL, headers=headers, timeout=15
        ) as client:
            r = await client.get(f"/v3/accounts/{account_id}/summary")
            if r.status_code != 200:
                raise Exception(f"OANDA {r.status_code}: {r.text[:120]}")
            acct = r.json().get("account", {})
            return {
                "balance":      float(acct.get("balance",      0)),
                "equity":       float(acct.get("NAV",          acct.get("balance", 0))),
                "profit":       float(acct.get("unrealizedPL", 0)),
                "currency":     acct.get("currency", "USD"),
                "account_name": account_id,
                "connected":    True,
            }
    except Exception as e:
        logger.warning(f"OANDA live fetch failed: {e}")
        return _fallback(broker)


def _fallback(broker: BrokerConnection) -> dict:
    """Return last-known cached values when live fetch fails."""
    return {
        "balance":      float(broker.last_balance or 0),
        "equity":       float(broker.last_equity  or 0),
        "profit":       0.0,
        "currency":     broker.currency or "USD",
        "account_name": broker.account_number,
        "connected":    False,
    }


async def _get_live(broker: BrokerConnection) -> dict:
    key = _broker_key(broker)
    if key in DERIV_NAMES:
        return await _live_deriv(broker)
    if key in OANDA_NAMES:
        return await _live_oanda(broker)
    return _fallback(broker)


def _cache_to_db(broker: BrokerConnection, live: dict, db: Session):
    try:
        broker.last_balance   = live["balance"]
        broker.last_equity    = live["equity"]
        broker.currency       = live["currency"]
        broker.last_connected = datetime.utcnow()
        db.commit()
    except Exception:
        db.rollback()


# ══════════════════════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════════════════════

# ── GET / — plain ARRAY so useLiveTrades Array.isArray() check passes ──────
@router.get("/")
async def get_accounts(
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    brokers = (
        db.query(BrokerConnection)
        .filter_by(user_id=current_user.id, is_active=True)
        .all()
    )

    if not brokers:
        return []

    accounts = []
    for i, b in enumerate(brokers):
        live = await _get_live(b)
        _cache_to_db(b, live, db)
        accounts.append({
            "id":             b.id,
            "account_number": b.account_number,
            "broker":         b.broker_name,
            "broker_type":    _broker_key(b),
            "platform":       (
                "Deriv" if _broker_key(b) in DERIV_NAMES else
                "OANDA" if _broker_key(b) in OANDA_NAMES else "MT5"
            ),
            "balance":        live["balance"],
            "equity":         live["equity"],
            "profit":         live["profit"],
            "currency":       live["currency"],
            "account_name":   live["account_name"],
            "is_default":     i == 0,   # first account is default
            "status":         "connected" if live["connected"] else "disconnected",
            "connected":      live["connected"],
        })

    return accounts


# ── GET /{id}/live-data — polled every 6s by useLiveTrades ────────────────
@router.get("/{account_id}/live-data")
async def get_live_data(
    account_id:   int,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    broker = (
        db.query(BrokerConnection)
        .filter_by(id=account_id, user_id=current_user.id)
        .first()
    )
    if not broker:
        raise HTTPException(status_code=404, detail="Account not found")

    live = await _get_live(broker)
    _cache_to_db(broker, live, db)

    return {
        # useLiveTrades reads: data.account_info.balance/equity/profit/currency
        "account_info": {
            "balance":  live["balance"],
            "equity":   live["equity"],
            "profit":   live["profit"],
            "currency": live["currency"],
            "name":     live["account_name"],
            "login":    broker.account_number,
        },
        # useLiveTrades reads: data.positions
        "positions":       [],
        "positions_count": 0,
        "connected":       live["connected"],
        "broker":          broker.broker_name,
        "broker_type":     _broker_key(broker),
    }


# ── GET /info — legacy endpoint ───────────────────────────────────────────
@router.get("/info")
async def get_account_info(
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    broker = (
        db.query(BrokerConnection)
        .filter_by(user_id=current_user.id, is_active=True)
        .order_by(BrokerConnection.id.desc())
        .first()
    )
    if not broker:
        return {
            "balance": 0, "equity": 0, "margin": 0,
            "free_margin": 0, "margin_level": 0, "profit": 0,
            "note": "No account connected",
        }

    live = await _get_live(broker)
    _cache_to_db(broker, live, db)

    return {
        "balance":      live["balance"],
        "equity":       live["equity"],
        "margin":       0.0,
        "free_margin":  live["equity"],
        "margin_level": 0.0,
        "profit":       live["profit"],
        "currency":     live["currency"],
        "connected":    live["connected"],
        "broker":       broker.broker_name,
        "account_name": live["account_name"],
    }


# ── POST /create ───────────────────────────────────────────────────────────
class AccountCreate(BaseModel):
    broker: str
    account_number: str
    password: str
    server: str


@router.post("/create")
async def create_account(
    account: AccountCreate,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    from app.services.encryption import EncryptionService
    enc = EncryptionService()
    b = BrokerConnection(
        user_id=current_user.id,
        broker_name=account.broker,
        account_number=account.account_number,
        server=account.server,
        encrypted_password=enc.encrypt(account.password),
    )
    db.add(b)
    db.commit()
    return {
        "message":        "Account saved successfully",
        "account_number": account.account_number,
        "broker":         account.broker,
        "status":         "saved",
    }


# ── GET /{account_id} — single account ────────────────────────────────────
@router.get("/{account_id}")
async def get_account(
    account_id:   int,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    broker = (
        db.query(BrokerConnection)
        .filter_by(id=account_id, user_id=current_user.id)
        .first()
    )
    if not broker:
        raise HTTPException(status_code=404, detail="Account not found")

    live = await _get_live(broker)
    return {
        "id":             broker.id,
        "account_number": broker.account_number,
        "broker":         broker.broker_name,
        "balance":        live["balance"],
        "equity":         live["equity"],
        "profit":         live["profit"],
        "currency":       live["currency"],
        "connected":      live["connected"],
    }
