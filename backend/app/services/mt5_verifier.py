from app.services.mt5_wrapper import get_mt5

mt5 = get_mt5()


class MT5Verifier:
    @staticmethod
    def verify(account_number: int, password: str, server: str):
        """
        Attempts MT5 login with provided credentials.
        Returns (success: bool, message: str, info: dict | None)

        On Render (where MT5 is unavailable), skips verification
        and returns success so the setup wizard completes normally.
        """
        # ── Guard: MT5 not available on Render ────────────────
        if mt5 is None:
            return True, "MT5 not available on cloud deployment — skipped", {
                "balance":  0.0,
                "equity":   0.0,
                "currency": "USD",
            }

        # ── Local: full MT5 verification ──────────────────────
        try:
            if not mt5.initialize():
                return False, f"Failed to initialize MT5: {mt5.last_error()}", None

            authorized = mt5.login(
                login=int(account_number),
                password=password,
                server=server,
            )

            if not authorized:
                error = mt5.last_error()
                mt5.shutdown()
                return False, f"MT5 login failed: {error}", None

            account_info = mt5.account_info()
            if account_info is None:
                mt5.shutdown()
                return False, "Could not retrieve account info", None

            info = {
                "balance":  float(account_info.balance),
                "equity":   float(account_info.equity),
                "currency": account_info.currency,
            }

            mt5.shutdown()
            return True, "MT5 credentials verified successfully", info

        except Exception as e:
            try:
                mt5.shutdown()
            except Exception:
                pass
            return False, f"MT5 verification error: {str(e)}", None



