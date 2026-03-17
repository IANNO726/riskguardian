import sys
sys.path.insert(0, '.')
from app.database.database import Base, engine
from app.routes.risk_rules_engine import RiskRule, RuleTriggerLog, TradeBlock

Base.metadata.create_all(bind=engine)
print('Done: enterprise_risk_rules, enterprise_rule_logs, enterprise_trade_blocks created')
