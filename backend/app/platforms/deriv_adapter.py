"""
Deriv Adapter — Per-User Credentials (SaaS-safe)
=================================================
Each user stores their own MT5 credentials in TradingAccount:
  - account_number     = MT5 numeric login (e.g. 40979584)
  - encrypted_password = MT5 password (encrypted)
  - api_token          = Deriv API token (encrypted)

NO shared env var fallback for user credentials.
MT5_ACCOUNT_SERVER env var is only used as a server name hint.

Flow:
  1. DerivAdapter receives per-user credentials from DB
  2. On Render (Linux): MT5 terminal unavailable → WS-only mode
     - Uses api_token for WebSocket auth
     - Gets balance from trading_platform_accounts
  3. On Windows (local): MT5 terminal available → full live data
     - Uses MT5 login + password for terminal connection
     - Gets equity, positions, P&L from MT5 directly
"""

import asyncio
import websockets
import json
import logging
import os
import threading
import time
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

DERIV_APP_ID = os.getenv("DERIV_APP_ID", "1089")
DERIV_WS_URL = f"wss://ws.derivws.com/websockets/v3?app_id={DERIV_APP_ID}"

# Only used as default server name — NOT for user credentials
MT5_DEFAULT_SERVER = os.getenv("MT5_ACCOUNT_SERVER", "Deriv-Demo")

COMMON_TERMINAL_PATHS = [
    r"C:\Program Files\Deriv\terminal64.exe",
    r"C:\Program Files\MetaTrader 5\terminal64.exe",
    r"C:\Program Files (x86)\MetaTrader 5\terminal64.exe",
    r"C:\MT5\terminal64.exe",
]

_mt5_lock   = threading.Lock()
_mt5_active: Dict[str, Any] = {}


# ──────────────────────────────────────────────────────────────
# MT5 TERMINAL HELPERS
# ──────────────────────────────────────────────────────────────

def _find_terminal() -> Optional[str]:
    terminal_path = os.getenv("MT5_TERMINAL_PATH", "")
    if terminal_path and os.path.exists(terminal_path):
        return terminal_path
    for p in COMMON_TERMINAL_PATHS:
        if os.path.exists(p):
            return p
    return None


def _mt5_init(mt5) -> bool:
    try:
        path = _find_terminal()
        if path:
            if mt5.initialize(path=path):
                return True
            logger.warning(f"mt5.initialize(path) failed: {mt5.last_error()}")
        if mt5.initialize():
            return True
        logger.error(f"mt5.initialize() failed: {mt5.last_error()}")
        return False
    except Exception as e:
        logger.error(f"MT5 init error: {e}")
        return False


def _mt5_connect(login: int, password: str, server: str) -> bool:
    try:
        from app.services.mt5_wrapper import get_mt5
        mt5 = get_mt5()
        if mt5 is None:
            return False   # Linux/Render — no MT5

        # Reuse existing session if same account
        if (
            _mt5_active.get("login") == login
            and _mt5_active.get("server") == server
            and mt5.account_info() is not None
        ):
            return True

        try:
            mt5.shutdown()
        except Exception:
            pass
        _mt5_active.clear()

        if not _mt5_init(mt5):
            return False

        if mt5.login(login=login, password=password, server=server):
            _mt5_active["login"]  = login
            _mt5_active["server"] = server
            logger.info(f"✅ MT5 connected: {login} @ {server}")
            return True

        logger.error(f"MT5 login failed {login}@{server}: {mt5.last_error()}")
        mt5.shutdown()
        _mt5_active.clear()
        return False
    except Exception as e:
        logger.error(f"MT5 connect error: {e}")
        return False


# ──────────────────────────────────────────────────────────────
# WEBSOCKET HELPERS
# ──────────────────────────────────────────────────────────────

async def _ws_authorize(api_token: str) -> Tuple[Optional[Any], Optional[Dict]]:
    try:
        ws = await asyncio.wait_for(
            websockets.connect(DERIV_WS_URL, ping_interval=20, ping_timeout=10, close_timeout=5),
            timeout=15,
        )
        await ws.send(json.dumps({"authorize": api_token}))
        raw  = await asyncio.wait_for(ws.recv(), timeout=12)
        data = json.loads(raw)
        if "error" in data or not data.get("authorize"):
            await ws.close()
            return None, None
        return ws, data["authorize"]
    except Exception as e:
        logger.warning(f"WS authorize failed: {e}")
        return None, None


async def _ws_req(ws, payload: dict, timeout: float = 12.0) -> dict:
    msg_type = next(k for k in payload if not k.startswith("_"))
    await ws.send(json.dumps(payload))
    deadline = time.time() + timeout
    while time.time() < deadline:
        raw  = await asyncio.wait_for(ws.recv(), timeout=min(deadline - time.time(), 5.0))
        data = json.loads(raw)
        if "error" in data:
            raise Exception(f"[{data['error'].get('code')}] {data['error'].get('message')}")
        if data.get("msg_type") == msg_type:
            return data
    raise Exception(f"Timeout for {msg_type}")


def _env_to_server(env: str) -> str:
    return {
        "Deriv-Demo":      "Deriv-Demo",
        "Deriv-Server":    "Deriv-Server",
        "DerivSVG-Demo":   "DerivSVG-Demo",
        "DerivSVG-Server": "DerivSVG-Server",
    }.get(env, env or "Deriv-Demo")


def _pick_target_account(accounts: List[Dict], stored_loginid: str) -> Optional[Dict]:
    if not accounts:
        return None
    stored_digits = "".join(c for c in stored_loginid if c.isdigit())
    for acc in accounts:
        login = str(acc.get("login", ""))
        if login == stored_loginid:
            return acc
        login_digits = "".join(c for c in login if c.isdigit())
        if stored_digits and login_digits == stored_digits:
            return acc
    return max(accounts, key=lambda a: float(a.get("balance", 0)), default=accounts[0])


# ──────────────────────────────────────────────────────────────
# MAIN ADAPTER
# ──────────────────────────────────────────────────────────────

class DerivAdapter:
    """
    Per-user Deriv adapter for SaaS.
    Each user's credentials come from their TradingAccount DB record.
    Never reads from shared env vars for user credentials.
    """

    def __init__(self, credentials: Dict[str, Any]):
        self.credentials = credentials

        # MT5 credentials (per user, from DB)
        mt5_login_raw      = str(credentials.get("account_number") or credentials.get("login") or "")
        self._mt5_login    = int("".join(c for c in mt5_login_raw if c.isdigit()) or "0")
        self._mt5_password = credentials.get("password", "")           # MT5 password
        self._mt5_server   = credentials.get("server", "") or MT5_DEFAULT_SERVER

        # Deriv API token (per user, from DB api_token field)
        self.api_token     = credentials.get("api_token", "") or ""
        self.deriv_loginid = mt5_login_raw

        # State
        self._connected_mt5 = False
        self._ws:   Optional[Any]  = None
        self._auth: Optional[Dict] = None

        # Cached meta
        self._name:     str = ""
        self._currency: str = "USD"
        self._server:   str = self._mt5_server or "Deriv-Demo"
        self._company:  str = "Deriv.com Limited"
        self._leverage: int = 1000

        logger.info(
            f"DerivAdapter init: mt5_login={self._mt5_login} "
            f"server={self._mt5_server} "
            f"has_api_token={bool(self.api_token)}"
        )

    async def connect(self) -> bool:
        # ── Primary: MT5 terminal (Windows/local only) ─────────────────
        if self._mt5_login:
            with _mt5_lock:
                ok = _mt5_connect(self._mt5_login, self._mt5_password, self._mt5_server)
            if ok:
                self._connected_mt5 = True
                logger.info(f"✅ DerivAdapter MT5: {self._mt5_login} @ {self._mt5_server}")
                await self._ws_meta()
                return True
            logger.warning(f"MT5 terminal unavailable for {self._mt5_login} — WS fallback")

        # ── Fallback: WebSocket (Render/Linux) ─────────────────────────
        if self.api_token:
            logger.info(f"WS fallback: token={self.api_token[:8]}... len={len(self.api_token)}")
            ws, auth = await _ws_authorize(self.api_token)
            if ws:
                self._ws   = ws
                self._auth = auth
                self._name = auth.get("fullname", "")
                logger.info(f"⚠️  DerivAdapter WS-only mode: {auth.get('loginid')}")
                await self._ws_load_mt5_meta(ws)
                return True
            logger.error("DerivAdapter: WS auth failed — check API token scopes")
        else:
            logger.error("DerivAdapter: no API token and no MT5 terminal — returning zeros")

        self._connected_mt5 = False
        return True   # return True to avoid 503 — serve zeros instead

    async def _ws_meta(self):
        """Grab account meta from WS after MT5 connect."""
        if not self.api_token:
            return
        try:
            ws, auth = await asyncio.wait_for(_ws_authorize(self.api_token), timeout=10)
            if not ws:
                return
            self._name = auth.get("fullname", "")
            try:
                resp     = await _ws_req(ws, {"trading_platform_accounts": 1, "platform": "mt5"})
                accounts = resp.get("trading_platform_accounts", [])
                logger.info(f"WS meta: {len(accounts)} MT5 accounts")
                target = _pick_target_account(accounts, str(self._mt5_login))
                if target:
                    self._currency = target.get("currency", "USD")
                    self._leverage = int(target.get("leverage", 1000))
                    env = target.get("server_info", {}).get("environment", "Deriv-Demo")
                    self._server  = _env_to_server(env)
                    self._company = target.get("landing_company", "Deriv.com Limited")
            except Exception:
                pass
            try:
                await ws.close()
            except Exception:
                pass
        except Exception:
            pass

    async def _ws_load_mt5_meta(self, ws):
        """Load MT5 account info in WS-only mode."""
        try:
            resp     = await _ws_req(ws, {"trading_platform_accounts": 1, "platform": "mt5"})
            accounts = resp.get("trading_platform_accounts", [])
            logger.info(f"WS MT5 accounts: {len(accounts)} — looking for login {self._mt5_login}")
            target = _pick_target_account(accounts, str(self._mt5_login))
            if target:
                self._currency = target.get("currency", "USD")
                self._leverage = int(target.get("leverage", 1000))
                env = target.get("server_info", {}).get("environment", "Deriv-Demo")
                self._server  = _env_to_server(env)
                self._company = target.get("landing_company", "Deriv.com Limited")
                logger.info(f"WS meta loaded: currency={self._currency} server={self._server}")
        except Exception as e:
            logger.warning(f"_ws_load_mt5_meta failed: {e}")

    async def disconnect(self):
        self._connected_mt5 = False
        if self._ws:
            try:
                await self._ws.close()
            except Exception:
                pass
            self._ws = None

    async def get_account_info(self) -> Optional[Dict[str, Any]]:
        # ── MT5 terminal (Windows) ─────────────────────────────────────
        if self._connected_mt5 and self._mt5_login:
            try:
                from app.services.mt5_wrapper import get_mt5
                mt5 = get_mt5()
                if mt5 is not None:
                    with _mt5_lock:
                        if not _mt5_connect(self._mt5_login, self._mt5_password, self._mt5_server):
                            raise Exception("MT5 reconnect failed")
                        info = mt5.account_info()
                    if info:
                        logger.info(
                            f"MT5 live: login={info.login} balance={info.balance} "
                            f"equity={info.equity} profit={info.profit}"
                        )
                        return {
                            "login":       str(info.login),
                            "balance":     float(info.balance),
                            "equity":      float(info.equity),
                            "profit":      float(info.profit),
                            "margin":      float(info.margin),
                            "margin_free": float(info.margin_free),
                            "currency":    info.currency or self._currency,
                            "leverage":    int(info.leverage) or self._leverage,
                            "name":        info.name or self._name,
                            "server":      info.server or self._server,
                            "company":     info.company or self._company,
                        }
            except Exception as e:
                logger.warning(f"MT5 get_account_info failed: {e}")

        # ── WebSocket fallback (Render) ─────────────────────────────────
        if self._ws:
            try:
                resp     = await _ws_req(self._ws, {"trading_platform_accounts": 1, "platform": "mt5"})
                accounts = resp.get("trading_platform_accounts", [])
                target   = _pick_target_account(accounts, str(self._mt5_login))
                if target:
                    balance = float(target.get("balance", 0))
                    logger.info(f"WS account info: login={target.get('login')} balance={balance}")
                    return {
                        "login":       str(target.get("login", self._mt5_login)),
                        "balance":     balance,
                        "equity":      balance,   # WS doesn't expose live equity
                        "profit":      0.0,
                        "margin":      0.0,
                        "margin_free": balance,
                        "currency":    target.get("currency", self._currency),
                        "leverage":    int(target.get("leverage", self._leverage)),
                        "name":        self._name,
                        "server":      self._server,
                        "company":     self._company,
                    }
            except Exception as e:
                logger.warning(f"WS get_account_info failed: {e}")

        # ── No data available ──────────────────────────────────────────
        logger.warning(f"get_account_info: no data for login={self._mt5_login}")
        return {
            "login":       str(self._mt5_login),
            "balance":     0.0,
            "equity":      0.0,
            "profit":      0.0,
            "margin":      0.0,
            "margin_free": 0.0,
            "currency":    self._currency or "USD",
            "leverage":    self._leverage or 1000,
            "name":        self._name or "",
            "server":      self._server or "Deriv-Demo",
            "company":     self._company or "Deriv.com Limited",
        }

    async def get_open_positions(self) -> List[Dict[str, Any]]:
        # ── MT5 terminal ──────────────────────────────────────────────
        if self._connected_mt5 and self._mt5_login:
            try:
                from app.services.mt5_wrapper import get_mt5
                mt5 = get_mt5()
                if mt5 is not None:
                    with _mt5_lock:
                        if not _mt5_connect(self._mt5_login, self._mt5_password, self._mt5_server):
                            raise Exception("MT5 reconnect failed")
                        positions = mt5.positions_get()
                    if positions:
                        logger.info(f"MT5 positions: {len(positions)} open")
                        return [dict(p._asdict()) for p in positions]
                    return []
            except Exception as e:
                logger.warning(f"MT5 get_open_positions failed: {e}")

        # ── WS fallback: portfolio ─────────────────────────────────────
        if self._ws:
            try:
                resp      = await _ws_req(self._ws, {"portfolio": 1})
                contracts = resp.get("portfolio", {}).get("contracts", [])
                if contracts:
                    return [{
                        "ticket":        c.get("contract_id", 0),
                        "symbol":        c.get("underlying",  ""),
                        "type":          0,
                        "volume":        float(c.get("buy_price",   0)),
                        "price_open":    float(c.get("buy_price",   0)),
                        "price_current": float(c.get("bid_price",   0)),
                        "profit":        float(c.get("profit_loss", 0)),
                        "swap": 0.0, "commission": 0.0, "sl": 0.0, "tp": 0.0,
                        "comment": c.get("contract_type", ""),
                        "time":    c.get("date_start",    0),
                    } for c in contracts]
            except Exception as e:
                logger.debug(f"portfolio: {e}")

        return []

    async def get_trade_history(self, days: int = 30) -> List[Dict[str, Any]]:
        # ── MT5 terminal ──────────────────────────────────────────────
        if self._connected_mt5 and self._mt5_login:
            try:
                from app.services.mt5_wrapper import get_mt5
                mt5 = get_mt5()
                if mt5 is not None:
                    with _mt5_lock:
                        if not _mt5_connect(self._mt5_login, self._mt5_password, self._mt5_server):
                            raise Exception("MT5 reconnect failed")
                        date_from = datetime.now() - timedelta(days=days)
                        deals = mt5.history_deals_get(date_from, datetime.now())
                    if deals:
                        logger.info(f"MT5 history: {len(deals)} deals")
                        return [dict(d._asdict()) for d in deals]
                    return []
            except Exception as e:
                logger.warning(f"MT5 get_trade_history failed: {e}")

        # ── WS fallback: statement ─────────────────────────────────────
        if self._ws:
            date_from = int(time.time()) - (days * 86400)
            try:
                resp = await _ws_req(self._ws, {
                    "statement": 1, "description": 1,
                    "limit": 200, "date_from": date_from,
                })
                txns = resp.get("statement", {}).get("transactions", [])
                logger.info(f"WS statement: {len(txns)} transactions")
                return [{
                    "ticket":  t.get("transaction_id",   0),
                    "symbol":  t.get("shortcode",        ""),
                    "type":    t.get("action_type",      ""),
                    "profit":  float(t.get("amount",     0)),
                    "balance": float(t.get("balance_after", 0)),
                    "time":    t.get("transaction_time", 0),
                    "comment": t.get("longcode",         ""),
                } for t in txns]
            except Exception as e:
                logger.warning(f"WS get_trade_history failed: {e}")

        return []

    async def get_orders(self) -> List[Dict[str, Any]]:
        if self._connected_mt5 and self._mt5_login:
            try:
                from app.services.mt5_wrapper import get_mt5
                mt5 = get_mt5()
                if mt5 is not None:
                    with _mt5_lock:
                        _mt5_connect(self._mt5_login, self._mt5_password, self._mt5_server)
                        orders = mt5.orders_get()
                    return [dict(o._asdict()) for o in orders] if orders else []
            except Exception:
                pass
        return []


# ──────────────────────────────────────────────────────────────
# ADAPTER CREDENTIALS BUILDER
# Called by accounts_multi.py get_adapter()
# ──────────────────────────────────────────────────────────────

def build_deriv_credentials(account) -> Dict[str, Any]:
    """
    Build credentials dict from TradingAccount DB record.
    Decrypts both MT5 password and API token.
    """
    from app.utils.encryption import decrypt_password
    return {
        "account_number": account.account_number,   # MT5 numeric login
        "login":          account.account_number,
        "password":       decrypt_password(account.encrypted_password),  # MT5 password
        "api_token":      decrypt_password(account.api_token) if account.api_token else "",
        "server":         account.server or "Deriv-Demo",
    }


# ──────────────────────────────────────────────────────────────
# VERIFIER
# ──────────────────────────────────────────────────────────────

class DerivVerifier:
    @staticmethod
    async def verify(api_token: str):
        ws, auth = await _ws_authorize(api_token)
        if not ws:
            return False, "Could not connect to Deriv — check your API token", None
        try:
            balance  = float(auth.get("balance",  0))
            currency = auth.get("currency",        "USD")
            loginid  = auth.get("loginid",         "")
            name     = auth.get("fullname",        "")
            server   = "Deriv"

            try:
                resp     = await _ws_req(ws, {"trading_platform_accounts": 1, "platform": "mt5"})
                accounts = resp.get("trading_platform_accounts", [])
                if accounts:
                    best     = max(accounts, key=lambda a: float(a.get("balance", 0)))
                    balance  = float(best.get("balance", balance))
                    currency = best.get("currency", currency)
                    env      = best.get("server_info", {}).get("environment", "Deriv-Demo")
                    server   = _env_to_server(env)
                    logger.info(
                        f"Verify: {len(accounts)} MT5 accounts, "
                        f"best={best.get('login')} balance={balance}"
                    )
            except Exception:
                pass

            return True, "Deriv API token verified successfully", {
                "login":    loginid,
                "balance":  balance,
                "equity":   balance,
                "currency": currency,
                "server":   server,
                "name":     name,
            }
        finally:
            try:
                await ws.close()
            except Exception:
                pass



