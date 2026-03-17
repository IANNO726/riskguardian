"""
MT5 Adapter — Per-User Connection
===================================
IMPORTANT: Only used for NON-Deriv brokers (FTMO, Exness, IC Markets etc.)
Deriv accounts (any Deriv-* server) automatically use DerivAdapter instead.

Fixes applied:
  ✅ MT5_TERMINAL_PATH from .env → C:\Program Files\Deriv\terminal64.exe
  ✅ Explicit path in mt5.initialize() → no more error -6
  ✅ Uncheck "Disable algo trading when account changed" in MT5 Options
  ✅ Thread-safe lock for sequential account switching
"""

import MetaTrader5 as mt5
import threading
import logging
import os
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

MT5_TERMINAL_PATH = os.getenv("MT5_TERMINAL_PATH", "")

COMMON_TERMINAL_PATHS = [
    r"C:\Program Files\Deriv\terminal64.exe",
    r"C:\Program Files\MetaTrader 5\terminal64.exe",
    r"C:\Program Files (x86)\MetaTrader 5\terminal64.exe",
    r"C:\Program Files\MetaTrader 5 Terminal\terminal64.exe",
    r"C:\Program Files\Fe Markets Corp MT5 Terminal\terminal64.exe",
    r"C:\Program Files\EGM Securities MetaTrader 5 Terminal\terminal64.exe",
    r"C:\MT5\terminal64.exe",
    r"D:\MT5\terminal64.exe",
]

_mt5_lock = threading.Lock()
_active_connection: Dict[str, Any] = {}


def _find_terminal_path() -> Optional[str]:
    if MT5_TERMINAL_PATH and os.path.exists(MT5_TERMINAL_PATH):
        return MT5_TERMINAL_PATH
    for p in COMMON_TERMINAL_PATHS:
        if os.path.exists(p):
            logger.info(f"MT5 terminal found at: {p}")
            return p
    return None


def _mt5_initialize() -> bool:
    path = _find_terminal_path()
    if path:
        logger.info(f"mt5.initialize(path='{path}')")
        if mt5.initialize(path=path):
            return True
        logger.warning(f"initialize(path=...) failed: {mt5.last_error()} — retrying without path")

    if mt5.initialize():
        return True

    err  = mt5.last_error()
    code = err[0] if isinstance(err, tuple) else err
    logger.error(f"MT5 initialize() failed: {err}")

    if code == -6:
        logger.error(
            "\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "  MT5 ERROR -6 FIX:\n"
            "  Tools → Options → Expert Advisors\n"
            "  ✅ Allow algorithmic trading\n"
            "  ❌ Disable algo trading when account changed  ← UNCHECK\n"
            "  ❌ Disable algo trading when profile changed  ← UNCHECK\n"
            "  ✅ Allow DLL imports\n"
            "  Restart MT5, restart backend.\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        )
    return False


def _connect(login: int, password: str, server: str) -> bool:
    """Initialize + login. Reuses existing session if same account."""
    if (
        _active_connection.get("login")  == login
        and _active_connection.get("server") == server
        and mt5.account_info() is not None
    ):
        return True

    try:
        mt5.shutdown()
    except Exception:
        pass
    _active_connection.clear()

    if not _mt5_initialize():
        return False

    authorized = mt5.login(login=login, password=password, server=server)
    if not authorized:
        err = mt5.last_error()
        logger.error(f"MT5 login failed for {login}@{server}: {err}")
        mt5.shutdown()
        _active_connection.clear()
        return False

    _active_connection["login"]  = login
    _active_connection["server"] = server
    logger.info(f"✅ MT5 connected: {login} @ {server}")
    return True


class MT5Adapter:
    def __init__(self, credentials: Dict[str, Any]):
        self.login    = int(credentials["login"])
        self.password = credentials["password"]
        self.server   = credentials["server"]
        self._connected = False

    async def connect(self) -> bool:
        with _mt5_lock:
            self._connected = _connect(self.login, self.password, self.server)
            return self._connected

    async def disconnect(self):
        self._connected = False

    async def get_account_info(self) -> Optional[Dict[str, Any]]:
        with _mt5_lock:
            if not _connect(self.login, self.password, self.server):
                return None
            info = mt5.account_info()
            if info is None:
                return None
            return {
                "login":       info.login,
                "balance":     info.balance,
                "equity":      info.equity,
                "profit":      info.profit,
                "margin":      info.margin,
                "margin_free": info.margin_free,
                "currency":    info.currency,
                "leverage":    info.leverage,
                "name":        info.name,
                "server":      info.server,
                "company":     info.company,
            }

    async def get_open_positions(self) -> List[Dict[str, Any]]:
        with _mt5_lock:
            if not _connect(self.login, self.password, self.server):
                return []
            positions = mt5.positions_get()
            return [p._asdict() for p in positions] if positions else []

    async def get_trade_history(self, days: int = 30) -> List[Dict[str, Any]]:
        with _mt5_lock:
            if not _connect(self.login, self.password, self.server):
                return []
            date_from = datetime.now() - timedelta(days=days)
            deals = mt5.history_deals_get(date_from, datetime.now())
            return [d._asdict() for d in deals] if deals else []

    async def get_orders(self) -> List[Dict[str, Any]]:
        with _mt5_lock:
            if not _connect(self.login, self.password, self.server):
                return []
            orders = mt5.orders_get()
            return [o._asdict() for o in orders] if orders else []


class MT5Verifier:
    @staticmethod
    def verify(account_number: int, password: str, server: str):
        with _mt5_lock:
            try:
                mt5.shutdown()
            except Exception:
                pass
            _active_connection.clear()

            if not _mt5_initialize():
                err  = mt5.last_error()
                code = err[0] if isinstance(err, tuple) else err
                if code == -6:
                    return False, (
                        "MT5 terminal blocking API. "
                        "Tools → Options → Expert Advisors → "
                        "uncheck 'Disable algo trading when account changed', restart MT5."
                    ), None
                return False, f"MT5 unavailable: {err}", None

            authorized = mt5.login(
                login=int(account_number), password=password, server=server
            )
            if not authorized:
                err = mt5.last_error()
                mt5.shutdown()
                _active_connection.clear()
                return False, f"MT5 login failed: {err}", None

            info = mt5.account_info()
            if info is None:
                mt5.shutdown()
                _active_connection.clear()
                return False, "Login OK but could not read account info", None

            data = {
                "login":    info.login,
                "balance":  info.balance,
                "equity":   info.equity,
                "currency": info.currency,
                "server":   info.server,
                "name":     info.name,
            }
            _active_connection["login"]  = int(account_number)
            _active_connection["server"] = server
            return True, "MT5 credentials verified successfully", data