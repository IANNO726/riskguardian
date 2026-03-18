import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.database import SessionLocal
from app.models.user import User

db = SessionLocal()
users = db.query(User).all()
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print(f"{'ID':<5} {'Username':<20} {'Plan':<12} {'Status'}")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
for u in users:
    print(f"{u.id:<5} {u.username:<20} {str(u.plan):<12} {u.subscription_status}")
db.close()


