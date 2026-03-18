import sys
sys.path.insert(0, '.')
from app.database.database import Base, engine
from app.routes.api_webhooks import APIKey, Webhook, WebhookLog
Base.metadata.create_all(bind=engine)
print('Done: enterprise_api_keys, enterprise_webhooks, enterprise_webhook_logs created')


