"""
add_trial_columns.py
Adds trial tracking columns to the users table.
Run once: python add_trial_columns.py
"""
import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

columns = [
    ("trial_ends_at",  "DATETIME DEFAULT NULL"),
    ("trial_used",     "BOOLEAN DEFAULT 0"),
    ("trial_plan",     "VARCHAR(20) DEFAULT 'pro'"),
]

print("Adding trial columns to users table...")

try:
    result = db.execute(text("PRAGMA table_info(users)"))
    existing = {row[1] for row in result.fetchall()}
except Exception:
    result = db.execute(text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'users'
    """))
    existing = {row[0] for row in result.fetchall()}

for col_name, col_def in columns:
    if col_name in existing:
        print(f"  ⏭️  {col_name} already exists")
        continue
    try:
        db.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}"))
        db.commit()
        print(f"  ✅ {col_name}")
    except Exception as e:
        db.rollback()
        print(f"  ⚠️  {col_name}: {e}")

db.close()
print("\nDone! Trial columns ready.")


