from app.services.mt5_wrapper import get_mt5\nmt5 = get_mt5()


class MT5Verifier:

    @staticmethod
    def verify(account_number: int, password: str, server: str):
        """
        Attempts MT5 login with provided credentials.
        Returns (success: bool, message: str)
        """

        # Initialize MT5
        if not mt5.initialize():
            return False, "Failed to initialize MT5"

        authorized = mt5.login(
            login=int(account_number),
            password=password,
            server=server
        )

        if not authorized:
            error = mt5.last_error()
            mt5.shutdown()
            return False, f"MT5 login failed: {error}"

        account_info = mt5.account_info()

        if account_info is None:
            mt5.shutdown()
            return False, "Could not retrieve account info"

        mt5.shutdown()

        return True, "MT5 credentials verified successfully"


