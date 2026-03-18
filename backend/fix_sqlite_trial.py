"""
Run from backend folder: python fix_sqlite_trial.py
Fixes trial columns on SQLite
"""
import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv(override=True)

from app.database.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

columns = [
    ("trial_ends_at", "DATETIME DEFAULT NULL"),
    ("trial_used",    "INTEGER DEFAULT 0"),
    ("trial_plan",    "VARCHAR(20) DEFAULT 'pro'"),
]

print("Checking users table (SQLite)...")
result   = db.execute(text("PRAGMA table_info(users)"))
existing = {row[1] for row in result.fetchall()}
print(f"Existing columns: {existing}\n")

for col, defn in columns:
    if col in existing:
        print(f"  ⏭️  {col} — already exists")
        continue
    try:
        db.execute(text(f"ALTER TABLE users ADD COLUMN {col} {defn}"))
        db.commit()
        print(f"  ✅ Added: {col}")
    except Exception as e:
        db.rollback()
        print(f"  ⚠️  {col}: {e}")

db.close()
print("\n✅ Done! Restart your backend now.")



