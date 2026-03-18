"""
add_referral_onboarding_columns.py  (SQLite version)
Run from backend folder: python add_referral_onboarding_columns.py
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "riskguardian.db")

COLUMNS = [
    ("referral_code",           "VARCHAR(20)"),
    ("referred_by",             "VARCHAR(20)"),
    ("referral_count",          "INTEGER DEFAULT 0"),
    ("onboarding_completed",    "BOOLEAN DEFAULT 0"),
    ("onboarding_completed_at", "DATETIME"),
]

def run():
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found at: {DB_PATH}")
        print("   Start the backend first so tables are created, then re-run.")
        return

    print(f"✅ Found database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()

    cur.execute("PRAGMA table_info(users)")
    existing = {row[1] for row in cur.fetchall()}

    if not existing:
        print("❌ 'users' table not found — start the backend first, then re-run.")
        conn.close()
        return

    for col_name, col_type in COLUMNS:
        if col_name in existing:
            print(f"⏭️  Already exists: {col_name}")
        else:
            cur.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
            print(f"✅ Added: {col_name}")

    conn.commit()
    conn.close()
    print("\n✅ Migration complete!")

if __name__ == "__main__":
    run()



