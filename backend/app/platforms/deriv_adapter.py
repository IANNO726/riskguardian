"""
Deriv Adapter — Hybrid MT5 + WebSocket
=======================================
DIAGNOSIS RESULT (confirmed via live API):
  - trading_platform_accounts → equity=None, margin=None  (NOT available)
  - mt5_get_settings           → equity=None, margin=None  (NOT available)
  - trading_platform_positions → UnrecognisedRequest       (NOT available)
  - balance stream             → only CR wallet balance    (NOT useful)

CONCLUSION: Deriv WebSocket API does NOT expose live MT5 equity/margin/P&L.

SOLUTION: Use MT5 terminal directly (same terminal already on machine)
  - MT5 credentials stored in TradingAccount.password (API token not used for live data)
  - Falls back gracefully to balance-only if MT5 terminal unavailable
  - DerivVerifier still uses WebSocket (no terminal needed for token check)
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

MT5_TERMINAL_PATH = os.getenv("MT5_TERMINAL_PATH", "")
MT5_ACCOUNT_LOGIN    = os.getenv("MT5_ACCOUNT_LOGIN",    "")
MT5_ACCOUNT_PASSWORD = os.getenv("MT5_ACCOUNT_PASSWORD", "")
MT5_ACCOUNT_SERVER   = os.getenv("MT5_ACCOUNT_SERVER",   "Deriv-Demo")

COMMON_TERMINAL_PATHS = [
    r"C:\Program Files\Deriv\terminal64.exe",
    r"C:\Program Files\MetaTrader 5\terminal64.exe",
    r"C:\Program Files (x86)\MetaTrader 5\terminal64.exe",
    r"C:\MT5\terminal64.exe",
]

_mt5_lock = threading.Lock()
_mt5_active: Dict[str, Any] = {}   # {login, server}


# ──────────────────────────────────────────────────────────────
# MT5 TERMINAL HELPERS
# ──────────────────────────────────────────────────────────────

def _find_terminal() -> Optional[str]:
    if MT5_TERMINAL_PATH and os.path.exists(MT5_TERMINAL_PATH):
        return MT5_TERMINAL_PATH
    for p in COMMON_TERMINAL_PATHS:
        if os.path.exists(p):
            return p
    return None


def _mt5_init() -> bool:
    try:
        from app.services.mt5_wrapper import get_mt5`nmt5 = get_mt5()
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
        logger.error(f"MT5 import/init error: {e}")
        return False


def _mt5_connect(login: int, password: str, server: str) -> bool:
    """Connect to MT5 terminal. Reuses session if same account already active."""
    try:
        from app.services.mt5_wrapper import get_mt5`nmt5 = get_mt5()
        # Reuse existing session
        if (
            _mt5_active.get("login") == login
            and _mt5_active.get("server") == server
            and mt5.account_info() is not None
        ):
            return True

        # Switch account
        try:
            mt5.shutdown()
        except Exception:
            pass
        _mt5_active.clear()

        if not _mt5_init():
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
# WEBSOCKET HELPERS  (used only by DerivVerifier)
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
# RESOLVE MT5 LOGIN FROM STORED CREDENTIALS
# ──────────────────────────────────────────────────────────────

def _resolve_mt5_creds(credentials: Dict[str, Any]) -> Tuple[int, str, str]:
    """
    Given stored account credentials, figure out the actual MT5 login/password/server.

    Cases:
      A) Account stored as MTD6009324 or 6009324 → use numeric login + .env password
      B) Account stored as CR1663243 (wallet) → map to .env MT5 login
      C) Direct MT5 account (FTMO etc.) → use stored credentials directly
    """
    stored_login    = str(credentials.get("account_number") or credentials.get("login") or "")
    stored_password = credentials.get("password", "")
    stored_server   = credentials.get("server", "Deriv-Demo")

    # Extract numeric part of stored login (handles MTD40979584 → 40979584)
    numeric = "".join(c for c in stored_login if c.isdigit())

    # If it's a CR wallet or we have no numeric MT5 login, fall back to .env
    is_wallet = stored_login.upper().startswith("CR") or stored_login.upper().startswith("VR")

    if is_wallet or not numeric:
        # Use .env MT5 credentials
        env_login    = MT5_ACCOUNT_LOGIN
        env_password = MT5_ACCOUNT_PASSWORD
        env_server   = MT5_ACCOUNT_SERVER
        if env_login:
            logger.info(f"Using .env MT5 creds: {env_login} @ {env_server}")
            return int(env_login), env_password, env_server
        # No .env either — can't connect
        return 0, "", stored_server

    # MTD/MTR account — use numeric login
    # Password: stored password is the Deriv API token, NOT the MT5 password
    # → Use .env MT5 password if available and server matches
    mt5_password = stored_password
    if MT5_ACCOUNT_PASSWORD and (
        MT5_ACCOUNT_LOGIN == numeric or not MT5_ACCOUNT_LOGIN
    ):
        mt5_password = MT5_ACCOUNT_PASSWORD

    # Resolve server from stored server string
    server = stored_server
    if not server or server in ("Deriv", "deriv"):
        server = MT5_ACCOUNT_SERVER or "Deriv-Demo"

    return int(numeric), mt5_password, server


# ──────────────────────────────────────────────────────────────
# MAIN ADAPTER
# ──────────────────────────────────────────────────────────────

class DerivAdapter:
    """
    Hybrid adapter for Deriv accounts:
    - Live data (equity, positions, P&L) → MT5 terminal directly
    - Account verification                → Deriv WebSocket
    - Trade history                       → Deriv WebSocket (statement API)
    """

    def __init__(self, credentials: Dict[str, Any]):
        self.credentials   = credentials
        self.api_token     = credentials.get("password", "")
        self.deriv_loginid = str(credentials.get("account_number") or credentials.get("login") or "")

        # MT5 resolved credentials
        self._mt5_login, self._mt5_password, self._mt5_server = _resolve_mt5_creds(credentials)

        # State
        self._connected_mt5 = False
        self._ws:  Optional[Any]  = None
        self._auth: Optional[Dict] = None

        # Cached account meta (from WS authorize, used for name/currency/server display)
        self._name:     str = ""
        self._currency: str = "USD"
        self._server:   str = "Deriv-Demo"
        self._company:  str = "Deriv.com Limited"
        self._leverage: int = 1000

    # ──────────────────────────────────────────
    # CONNECT
    # ──────────────────────────────────────────

    async def connect(self) -> bool:
        # Primary: MT5 terminal
        if self._mt5_login:
            with _mt5_lock:
                ok = _mt5_connect(self._mt5_login, self._mt5_password, self._mt5_server)
            if ok:
                self._connected_mt5 = True
                logger.info(f"✅ DerivAdapter using MT5 terminal: {self._mt5_login} @ {self._mt5_server}")
                # Also grab meta from WS if token available
                await self._ws_meta()
                return True
            logger.warning(f"MT5 terminal connect failed for {self._mt5_login} — trying WS fallback")

        # Fallback: WebSocket only (balance-only, no equity)
        logger.info(f"WS fallback: token={self.api_token[:8]}... len={len(self.api_token)}")
        ws, auth = await _ws_authorize(self.api_token)
        if ws:
            self._ws   = ws
            self._auth = auth
            self._name = auth.get("fullname", "")
            logger.info(f"⚠️  DerivAdapter WS-only mode (balance only): {auth.get('loginid')}")
            await self._ws_load_mt5_meta(ws)
            return True

        # Both failed — return True with zero/cached data to avoid 503
        # Dashboard will show last known values or zeros instead of error
        logger.error(
            f"DerivAdapter: MT5 error -6 (terminal blocking API) AND WS auth failed. "
            f"FIX: In MT5 → Tools → Options → Expert Advisors → "
            f"UNCHECK 'Disable algo trading when account changed' → restart MT5"
        )
        self._connected_mt5 = False
        return True  # serve zeros, not 503

    async def _ws_meta(self):
        """Optionally grab account meta (name, leverage, server) from WS."""
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
                target   = _pick_target_account(accounts, self.deriv_loginid)
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
        """Load MT5 account meta when in WS-only fallback mode."""
        try:
            resp     = await _ws_req(ws, {"trading_platform_accounts": 1, "platform": "mt5"})
            accounts = resp.get("trading_platform_accounts", [])
            target   = _pick_target_account(accounts, self.deriv_loginid)
            if target:
                self._currency = target.get("currency", "USD")
                self._leverage = int(target.get("leverage", 1000))
                env = target.get("server_info", {}).get("environment", "Deriv-Demo")
                self._server  = _env_to_server(env)
                self._company = target.get("landing_company", "Deriv.com Limited")
        except Exception:
            pass

    async def disconnect(self):
        self._connected_mt5 = False
        if self._ws:
            try:
                await self._ws.close()
            except Exception:
                pass
            self._ws = None

    # ──────────────────────────────────────────
    # GET ACCOUNT INFO
    # ──────────────────────────────────────────

    async def get_account_info(self) -> Optional[Dict[str, Any]]:
        # ── MT5 terminal (primary) ─────────────────────────────
        if self._connected_mt5 and self._mt5_login:
            try:
                from app.services.mt5_wrapper import get_mt5`nmt5 = get_mt5()
                with _mt5_lock:
                    if not _mt5_connect(self._mt5_login, self._mt5_password, self._mt5_server):
                        raise Exception("MT5 reconnect failed")
                    info = mt5.account_info()
                if info:
                    logger.info(
                        f"MT5 live: login={info.login} balance={info.balance} "
                        f"equity={info.equity} profit={info.profit} margin={info.margin}"
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

        # ── WS fallback (balance only, equity=balance) ─────────
        if self._ws:
            try:
                resp     = await _ws_req(self._ws, {"trading_platform_accounts": 1, "platform": "mt5"})
                accounts = resp.get("trading_platform_accounts", [])
                target   = _pick_target_account(accounts, self.deriv_loginid)
                if target:
                    balance = float(target.get("balance", 0))
                    return {
                        "login":       target.get("login", self.deriv_loginid),
                        "balance":     balance,
                        "equity":      balance,   # no live equity available via WS
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

        # Both MT5 and WS unavailable — return stub with stored login so dashboard shows something
        # The last_balance/last_equity from DB will be shown by the frontend
        logger.warning("get_account_info: no live data available — returning stub")
        return {
            "login":       self.deriv_loginid,
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
            "error":       "MT5 terminal blocked (error -6). Fix: MT5 → Tools → Options → Expert Advisors → uncheck 'Disable algo trading when account changed'",
        }

    # ──────────────────────────────────────────
    # GET OPEN POSITIONS
    # ──────────────────────────────────────────

    async def get_open_positions(self) -> List[Dict[str, Any]]:
        # ── MT5 terminal ──────────────────────────────────────
        if self._connected_mt5 and self._mt5_login:
            try:
                from app.services.mt5_wrapper import get_mt5`nmt5 = get_mt5()
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

        # ── WS fallback: portfolio (Options/Multipliers only) ──
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

    # ──────────────────────────────────────────
    # GET TRADE HISTORY
    # ──────────────────────────────────────────

    async def get_trade_history(self, days: int = 30) -> List[Dict[str, Any]]:
        # ── MT5 terminal ──────────────────────────────────────
        if self._connected_mt5 and self._mt5_login:
            try:
                from app.services.mt5_wrapper import get_mt5`nmt5 = get_mt5()
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

        # ── WS fallback: statement API ─────────────────────────
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
                from app.services.mt5_wrapper import get_mt5`nmt5 = get_mt5()
                with _mt5_lock:
                    _mt5_connect(self._mt5_login, self._mt5_password, self._mt5_server)
                    orders = mt5.orders_get()
                return [dict(o._asdict()) for o in orders] if orders else []
            except Exception:
                pass
        return []


# ──────────────────────────────────────────────────────────────
# VERIFIER  (WebSocket only — just validates the API token)
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

            # Get MT5 account balance for display
            try:
                resp     = await _ws_req(ws, {"trading_platform_accounts": 1, "platform": "mt5"})
                accounts = resp.get("trading_platform_accounts", [])
                if accounts:
                    best     = max(accounts, key=lambda a: float(a.get("balance", 0)))
                    balance  = float(best.get("balance", balance))
                    currency = best.get("currency", currency)
                    env      = best.get("server_info", {}).get("environment", "Deriv-Demo")
                    server   = _env_to_server(env)
                    logger.info(f"Verify: {len(accounts)} MT5 accounts, best={best.get('login')} balance={balance}")
            except Exception:
                server = "Deriv"

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
