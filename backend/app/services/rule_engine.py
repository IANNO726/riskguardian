from sqlalchemy.orm import Session
from datetime import datetime
from app.models.risk_rule import RiskRule
from app.models.alert_setting import AlertSetting


class RuleViolation(Exception):
    pass


class RuleEngine:

    def __init__(self, db: Session):
        self.db = db

    # ===============================
    # MAIN VALIDATION ENTRY POINT
    # ===============================
    def validate_account(self, user_id: int, account_data: dict):
        """
        Validate all account rules.
        Returns list of violations.
        """
        rules = self.db.query(RiskRule).filter(
            RiskRule.user_id == user_id
        ).first()

        if not rules:
            return []

        violations = []

        # Daily loss check
        if self.check_daily_loss(account_data, rules):
            violations.append("Daily loss limit exceeded")

        # Max drawdown check
        if self.check_drawdown(account_data, rules):
            violations.append("Maximum drawdown exceeded")

        return violations

    # ===============================
    # DAILY LOSS CHECK
    # ===============================
    def check_daily_loss(self, account, rules):
        balance = account.get("balance", 0)
        daily_loss = abs(account.get("daily_loss", 0))

        if balance == 0:
            return False

        daily_loss_percent = (daily_loss / balance) * 100

        return daily_loss_percent >= rules.daily_loss_limit

    # ===============================
    # MAX DRAWDOWN CHECK
    # ===============================
    def check_drawdown(self, account, rules):
        peak = account.get("peak_balance", 0)
        equity = account.get("equity", 0)

        if peak == 0:
            return False

        drawdown_percent = ((peak - equity) / peak) * 100

        return drawdown_percent >= rules.max_drawdown

    # ===============================
    # TRADE VALIDATION
    # ===============================
    def validate_trade(self, user_id: int, trade_data: dict):
        """
        Validate single trade before execution.
        """
        rules = self.db.query(RiskRule).filter(
            RiskRule.user_id == user_id
        ).first()

        if not rules:
            return []

        violations = []

        # Risk per trade
        if self.check_risk_per_trade(trade_data, rules):
            violations.append("Risk per trade exceeds limit")

        # RR ratio
        if self.check_rr_ratio(trade_data, rules):
            violations.append("RR ratio below minimum")

        return violations

    # ===============================
    # RISK PER TRADE CHECK
    # ===============================
    def check_risk_per_trade(self, trade, rules):
        account_balance = trade.get("balance", 0)
        risk_amount = trade.get("risk_amount", 0)

        if account_balance == 0:
            return False

        risk_percent = (risk_amount / account_balance) * 100

        return risk_percent > rules.risk_per_trade

    # ===============================
    # RR RATIO CHECK
    # ===============================
    def check_rr_ratio(self, trade, rules):
        reward = trade.get("reward", 0)
        risk = trade.get("risk", 1)

        if risk == 0:
            return False

        rr = reward / risk

        return rr < rules.min_rr_ratio
    # ===============================
    # RISK STATUS FOR DASHBOARD
    # ===============================

    def risk_status(self, user_id: int, account_data: dict):
        """
        Returns overall risk status.
        Used by Dashboard and Terminal.
        """

        violations = self.validate_account(
            user_id,
            account_data
        )

        if violations:

            return {

                "blocked": True,

                "violations": violations

            }

        return {

            "blocked": False,

            "violations": []

        }



