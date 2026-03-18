"""
add_email_columns.py
SQLite-compatible version — adds email tracking columns to users table.
Run once: python add_email_columns.py
"""
import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.database import SessionLocal
from sqlalchemy import text, inspect

db = SessionLocal()

columns = [
    ("email_welcome_sent", "BOOLEAN DEFAULT 0"),
    ("email_day3_sent",    "BOOLEAN DEFAULT 0"),
    ("email_day7_sent",    "BOOLEAN DEFAULT 0"),
    ("email_unsubscribed", "BOOLEAN DEFAULT 0"),
]

print("Adding email tracking columns to users table...")

# Get existing columns first
try:
    result = db.execute(text("PRAGMA table_info(users)"))
    existing = {row[1] for row in result.fetchall()}
except Exception:
    # PostgreSQL fallback
    result = db.execute(text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'users'
    """))
    existing = {row[0] for row in result.fetchall()}

for col_name, col_def in columns:
    if col_name in existing:
        print(f"  ⏭️  {col_name} already exists, skipping")
        continue
    try:
        db.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}"))
        db.commit()
        print(f"  ✅ {col_name}")
    except Exception as e:
        db.rollback()
        print(f"  ⚠️  {col_name}: {e}")

db.close()
print("\nDone! Email columns are ready.")



