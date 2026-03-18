"""
Run once: python add_telegram_column.py
Adds telegram_chat_id column to users table
"""
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), "backend", "riskguardian.db")
if not os.path.exists(DB_PATH):
    # try current dir
    DB_PATH = "riskguardian.db"

conn = sqlite3.connect(DB_PATH)
cur  = conn.cursor()

columns_to_add = [
    ("telegram_chat_id", "VARCHAR(64) DEFAULT NULL"),
    ("webhook_url",       "VARCHAR(500) DEFAULT NULL"),
    ("alert_trade_open",  "INTEGER DEFAULT 1"),
    ("alert_trade_close", "INTEGER DEFAULT 1"),
    ("alert_daily_summary","INTEGER DEFAULT 1"),
]

for col, definition in columns_to_add:
    try:
        cur.execute(f"ALTER TABLE users ADD COLUMN {col} {definition}")
        print(f"✅ Added column: {col}")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e):
            print(f"⏭️  Column already exists: {col}")
        else:
            raise

conn.commit()
conn.close()
print("\n✅ Migration complete!")



