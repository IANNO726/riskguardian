try:
    from app.services.mt5_wrapper import get_mt5\nmt5 = get_mt5()
    MT5_AVAILABLE = True
except ImportError:
    mt5 = None
    MT5_AVAILABLE = False


def get_mt5():
    if not MT5_AVAILABLE:
        raise Exception("MetaTrader5 is not available in this environment")
    return mt5


def is_available():
    return MT5_AVAILABLE


