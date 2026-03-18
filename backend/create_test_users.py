"""
create_test_users.py
Place in: backend/
Run with: python create_test_users.py
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.database import SessionLocal
from app.models.user import User

# Try bcrypt, fall back to passlib
try:
    from passlib.context import CryptContext
    pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
    def hash_password(p): return pwd.hash(p)
except ImportError:
    import bcrypt
    def hash_password(p): return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

db = SessionLocal()

test_users = [
    {"username": "test_free",       "email": "free@test.com",       "plan": "free"},
    {"username": "test_starter",    "email": "starter@test.com",    "plan": "starter"},
    {"username": "test_pro",        "email": "pro@test.com",        "plan": "pro"},
    {"username": "test_enterprise", "email": "enterprise@test.com", "plan": "enterprise"},
]

PASSWORD = "Test1234!"

for u in test_users:
    try:
        existing = db.query(User).filter(User.username == u["username"]).first()
        if existing:
            existing.plan                = u["plan"]
            existing.subscription_status = "active"
            existing.is_active           = True
            print(f"🔄 Updated  {u['username']:20s} → plan={u['plan']}")
        else:
            user = User(
                username             = u["username"],
                email                = u["email"],
                full_name            = f"Test {u['plan'].title()} User",
                hashed_password      = hash_password(PASSWORD),
                plan                 = u["plan"],
                subscription_status  = "active",
                is_active            = True,
            )
            db.add(user)
            print(f"✅ Created  {u['username']:20s} → plan={u['plan']}")
    except Exception as e:
        print(f"❌ Error with {u['username']}: {e}")

db.commit()
db.close()

print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print("Test credentials (all use same password):")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print(f"  FREE:       test_free       / {PASSWORD}")
print(f"  STARTER:    test_starter    / {PASSWORD}")
print(f"  PRO:        test_pro        / {PASSWORD}")
print(f"  ENTERPRISE: test_enterprise / {PASSWORD}")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")



