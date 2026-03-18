try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    mt5 = None
    MT5_AVAILABLE = False


def get_mt5():
    """
    Safe MT5 getter.
    - Returns MT5 module if available (local Windows)
    - Returns None if NOT available (Render / Linux)
    """
    if not MT5_AVAILABLE:
        return None   # ✅ DO NOT crash in cloud
    return mt5


def is_available():
    """
    Check if MT5 is available in the environment
    """
    return MT5_AVAILABLE
