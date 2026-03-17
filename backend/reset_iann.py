import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.database import SessionLocal
from app.models.user import User

db = SessionLocal()
user = db.query(User).filter(User.username == 'Iann').first()
user.plan = 'starter'
user.subscription_status = 'active'
db.commit()
db.close()
print("✅ Iann reset to starter plan")