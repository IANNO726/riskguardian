import sys
sys.path.insert(0, '.')
from app.database.database import Base, engine
from app.routes.integrations import IntegrationConfig, TradingViewAlert, SheetsExportLog
Base.metadata.create_all(bind=engine)
print('Done: integration_configs, tradingview_alerts, sheets_export_logs created')
