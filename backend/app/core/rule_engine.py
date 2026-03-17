"""
Risk Guardian Agent - Rule Engine Core

This module contains the core rule evaluation engine that validates trades
against predefined risk management rules.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from enum import Enum
from dataclasses import dataclass
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


class RuleType(str, Enum):
    """Types of trading rules"""
    DAILY_LOSS_LIMIT = "daily_loss_limit"
    MAX_DRAWDOWN = "max_drawdown"
    MIN_RR_RATIO = "min_rr_ratio"
    MAX_LOT_SIZE = "max_lot_size"
    CONSECUTIVE_LOSS = "consecutive_loss"


class RuleSeverity(str, Enum):
    """Rule severity levels"""
    WARNING = "warning"
    CRITICAL = "critical"
    BLOCKING = "blocking"


class RuleStatus(str, Enum):
    """Status of rule evaluation"""
    PASS = "pass"
    WARNING = "warning"
    BREACH = "breach"


@dataclass
class RuleResult:
    """Result of a rule evaluation"""
    rule_type: RuleType
    status: RuleStatus
    severity: RuleSeverity
    is_breach: bool
    is_warning: bool
    message: str
    recommended_action: str
    current_value: Optional[float] = None
    threshold_value: Optional[float] = None
    percentage_of_threshold: Optional[float] = None
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()


@dataclass
class TradeValidationRequest:
    """Request for trade validation"""
    symbol: str
    entry_price: float
    stop_loss: float
    take_profit: float
    lot_size: float
    account_balance: float
    account_equity: float
    account_cash: float
    daily_pnl: float
    daily_loss: float
    peak_balance: float  # For drawdown calculation


@dataclass
class TradeValidationResponse:
    """Response from trade validation"""
    is_allowed: bool
    rules_passed: List[RuleResult]
    rules_warned: List[RuleResult]
    rules_breached: List[RuleResult]
    overall_status: str
    recommended_max_lot_size: float
    recommended_action: str
    timestamp: datetime


class RuleEngine:
    """Core rule evaluation engine for Risk Guardian Agent"""

    def __init__(self, rules_config: Dict = None):
        """
        Initialize the rule engine with configuration

        Args:
            rules_config: Dictionary containing rule thresholds
                {
                    'daily_loss_limit': 2.0,  # %
                    'max_drawdown': 5.0,  # %
                    'min_rr_ratio': 2.0,  # 1:X
                    'risk_per_trade': 1.0,  # %
                    'consecutive_loss_limit': 3
                }
        """
        self.rules_config = rules_config or self._get_default_config()
        logger.info(f"Rule Engine initialized with config: {self.rules_config}")

    @staticmethod
    def _get_default_config() -> Dict:
        """Get default rule configuration"""
        return {
            'daily_loss_limit': 2.0,
            'max_drawdown': 5.0,
            'min_rr_ratio': 2.0,
            'risk_per_trade': 1.0,
            'consecutive_loss_limit': 3,
        }

    def validate_trade(self, 
                      request: TradeValidationRequest,
                      trader_history: Dict = None) -> TradeValidationResponse:
        """
        Validate a trade against all rules

        Args:
            request: Trade validation request
            trader_history: Historical trade data for consecutive loss calculation

        Returns:
            TradeValidationResponse with all rule evaluations
        """
        daily_loss_result = self._check_daily_loss_limit(request)
        drawdown_result = self._check_max_drawdown(request)
        rr_ratio_result = self._check_rr_ratio(request)
        lot_size_result = self._check_lot_size(request)
        consecutive_loss_result = self._check_consecutive_losses(trader_history)

        all_results = [
            daily_loss_result,
            drawdown_result,
            rr_ratio_result,
            lot_size_result,
            consecutive_loss_result,
        ]

        # Categorize results
        passed = [r for r in all_results if r.status == RuleStatus.PASS]
        warned = [r for r in all_results if r.status == RuleStatus.WARNING]
        breached = [r for r in all_results if r.status == RuleStatus.BREACH]

        # Determine if trade is allowed
        is_allowed = len(breached) == 0
        if len(warned) > 0:
            is_allowed = True  # Phase 1: Warnings only, doesn't block

        # Calculate recommended max lot size
        recommended_max_lot_size = self._calculate_max_lot_size(request)

        # Generate overall recommendation
        recommended_action = self._generate_recommendation(passed, warned, breached)

        return TradeValidationResponse(
            is_allowed=is_allowed,
            rules_passed=passed,
            rules_warned=warned,
            rules_breached=breached,
            overall_status="PASS" if is_allowed else "BREACH",
            recommended_max_lot_size=recommended_max_lot_size,
            recommended_action=recommended_action,
            timestamp=datetime.utcnow()
        )

    def _check_daily_loss_limit(self, request: TradeValidationRequest) -> RuleResult:
        """Check if daily loss limit has been breached"""
        limit_percent = self.rules_config['daily_loss_limit']
        max_loss = (request.account_balance * limit_percent) / 100
        
        daily_loss = request.daily_loss
        percentage_of_limit = (daily_loss / max_loss * 100) if max_loss > 0 else 0

        if daily_loss >= max_loss:
            status = RuleStatus.BREACH
            severity = RuleSeverity.BLOCKING
            is_breach = True
            is_warning = False
            message = f"Daily loss limit reached: ${daily_loss:.2f} / ${max_loss:.2f} ({percentage_of_limit:.1f}%)"
            action = "BLOCK TRADING - Daily loss limit exceeded"
        elif daily_loss >= max_loss * 0.8:
            status = RuleStatus.WARNING
            severity = RuleSeverity.CRITICAL
            is_breach = False
            is_warning = True
            message = f"Approaching daily loss limit: ${daily_loss:.2f} / ${max_loss:.2f} ({percentage_of_limit:.1f}%)"
            action = "CAUTION - You are near daily loss limit"
        else:
            status = RuleStatus.PASS
            severity = RuleSeverity.WARNING
            is_breach = False
            is_warning = False
            message = f"Daily loss limit OK: ${daily_loss:.2f} / ${max_loss:.2f} ({percentage_of_limit:.1f}%)"
            action = "PASS - All clear"

        return RuleResult(
            rule_type=RuleType.DAILY_LOSS_LIMIT,
            status=status,
            severity=severity,
            is_breach=is_breach,
            is_warning=is_warning,
            message=message,
            recommended_action=action,
            current_value=daily_loss,
            threshold_value=max_loss,
            percentage_of_threshold=percentage_of_limit
        )

    def _check_max_drawdown(self, request: TradeValidationRequest) -> RuleResult:
        """Check if maximum drawdown limit has been breached"""
        max_dd_percent = self.rules_config['max_drawdown']
        peak_balance = request.peak_balance
        current_equity = request.account_equity
        
        # Calculate current drawdown
        drawdown = peak_balance - current_equity
        drawdown_percent = (drawdown / peak_balance * 100) if peak_balance > 0 else 0

        if drawdown_percent >= max_dd_percent:
            status = RuleStatus.BREACH
            severity = RuleSeverity.BLOCKING
            is_breach = True
            is_warning = False
            message = f"Maximum drawdown exceeded: {drawdown_percent:.2f}% / {max_dd_percent}%"
            action = "BLOCK TRADING & CLOSE ALL POSITIONS - Max DD breach"
        elif drawdown_percent >= max_dd_percent * 0.8:
            status = RuleStatus.WARNING
            severity = RuleSeverity.CRITICAL
            is_breach = False
            is_warning = True
            message = f"Approaching max drawdown: {drawdown_percent:.2f}% / {max_dd_percent}%"
            action = "CAUTION - High drawdown detected"
        else:
            status = RuleStatus.PASS
            severity = RuleSeverity.WARNING
            is_breach = False
            is_warning = False
            message = f"Drawdown OK: {drawdown_percent:.2f}% / {max_dd_percent}%"
            action = "PASS - All clear"

        return RuleResult(
            rule_type=RuleType.MAX_DRAWDOWN,
            status=status,
            severity=severity,
            is_breach=is_breach,
            is_warning=is_warning,
            message=message,
            recommended_action=action,
            current_value=drawdown_percent,
            threshold_value=max_dd_percent,
            percentage_of_threshold=(drawdown_percent / max_dd_percent * 100) if max_dd_percent > 0 else 0
        )

    def _check_rr_ratio(self, request: TradeValidationRequest) -> RuleResult:
        """Check if Risk:Reward ratio meets minimum requirement"""
        min_rr = self.rules_config['min_rr_ratio']
        
        # Calculate RR ratio
        risk = abs(request.entry_price - request.stop_loss)
        reward = abs(request.take_profit - request.entry_price)
        
        if risk == 0:
            rr_ratio = 0
        else:
            rr_ratio = reward / risk

        if rr_ratio < min_rr:
            status = RuleStatus.WARNING
            severity = RuleSeverity.WARNING
            is_breach = False
            is_warning = True
            message = f"RR Ratio below minimum: {rr_ratio:.2f}:1 < {min_rr}:1"
            action = f"RECOMMENDATION - Improve RR ratio to at least 1:{min_rr}"
        else:
            status = RuleStatus.PASS
            severity = RuleSeverity.WARNING
            is_breach = False
            is_warning = False
            message = f"RR Ratio OK: {rr_ratio:.2f}:1 >= {min_rr}:1"
            action = "PASS - All clear"

        return RuleResult(
            rule_type=RuleType.MIN_RR_RATIO,
            status=status,
            severity=severity,
            is_breach=is_breach,
            is_warning=is_warning,
            message=message,
            recommended_action=action,
            current_value=rr_ratio,
            threshold_value=min_rr,
            percentage_of_threshold=(rr_ratio / min_rr * 100) if min_rr > 0 else 0
        )

    def _check_lot_size(self, request: TradeValidationRequest) -> RuleResult:
        """Check if lot size doesn't exceed calculated maximum"""
        max_lot = self._calculate_max_lot_size(request)
        requested_lot = request.lot_size

        if requested_lot > max_lot:
            status = RuleStatus.WARNING
            severity = RuleSeverity.CRITICAL
            is_breach = False
            is_warning = True
            message = f"Lot size exceeds calculated maximum: {requested_lot} > {max_lot:.2f}"
            action = f"RECOMMENDATION - Reduce lot size to {max_lot:.2f}"
        else:
            status = RuleStatus.PASS
            severity = RuleSeverity.WARNING
            is_breach = False
            is_warning = False
            message = f"Lot size OK: {requested_lot} <= {max_lot:.2f}"
            action = "PASS - All clear"

        return RuleResult(
            rule_type=RuleType.MAX_LOT_SIZE,
            status=status,
            severity=severity,
            is_breach=is_breach,
            is_warning=is_warning,
            message=message,
            recommended_action=action,
            current_value=requested_lot,
            threshold_value=max_lot,
            percentage_of_threshold=(requested_lot / max_lot * 100) if max_lot > 0 else 0
        )

    def _check_consecutive_losses(self, trader_history: Dict = None) -> RuleResult:
        """Check for consecutive loss limit"""
        if trader_history is None:
            return RuleResult(
                rule_type=RuleType.CONSECUTIVE_LOSS,
                status=RuleStatus.PASS,
                severity=RuleSeverity.WARNING,
                is_breach=False,
                is_warning=False,
                message="No consecutive loss history available",
                recommended_action="PASS - All clear"
            )

        limit = self.rules_config['consecutive_loss_limit']
        consecutive_losses = trader_history.get('consecutive_losses', 0)

        if consecutive_losses >= limit:
            status = RuleStatus.WARNING
            severity = RuleSeverity.CRITICAL
            is_breach = False
            is_warning = True
            message = f"Consecutive losses at limit: {consecutive_losses} / {limit}"
            action = f"RECOMMENDATION - Take a break, review strategy"
        else:
            status = RuleStatus.PASS
            severity = RuleSeverity.WARNING
            is_breach = False
            is_warning = False
            message = f"Consecutive losses OK: {consecutive_losses} / {limit}"
            action = "PASS - All clear"

        return RuleResult(
            rule_type=RuleType.CONSECUTIVE_LOSS,
            status=status,
            severity=severity,
            is_breach=is_breach,
            is_warning=is_warning,
            message=message,
            recommended_action=action,
            current_value=consecutive_losses,
            threshold_value=limit,
            percentage_of_threshold=(consecutive_losses / limit * 100) if limit > 0 else 0
        )

    def _calculate_max_lot_size(self, request: TradeValidationRequest) -> float:
        """
        Calculate maximum allowed lot size based on risk management rules

        Formula: Max Lot = (Account Equity * Risk %) / Distance to SL
        """
        risk_percent = self.rules_config['risk_per_trade']
        account_risk = (request.account_equity * risk_percent) / 100

        distance_to_sl = abs(request.entry_price - request.stop_loss)

        if distance_to_sl == 0:
            return 0

        max_lot = account_risk / distance_to_sl
        return round(max_lot, 2)

    def _generate_recommendation(self, 
                                passed: List[RuleResult],
                                warned: List[RuleResult],
                                breached: List[RuleResult]) -> str:
        """Generate overall trading recommendation"""
        if len(breached) > 0:
            return f"❌ TRADE BLOCKED - {len(breached)} rule(s) breached"

        if len(warned) > 0:
            if len(warned) == 1:
                return f"⚠️ CAUTION - {warned[0].recommended_action}"
            else:
                return f"⚠️ CAUTION - {len(warned)} rule(s) triggered warnings"

        return "✅ TRADE ALLOWED - All rules passed"

    def update_config(self, new_config: Dict) -> None:
        """Update rule configuration"""
        self.rules_config.update(new_config)
        logger.info(f"Rule configuration updated: {self.rules_config}")

    def get_config(self) -> Dict:
        """Get current rule configuration"""
        return self.rules_config.copy()
