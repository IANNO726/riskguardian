import sys
import os
sys.path.insert(0, os.getcwd())
from app.database.database import engine
from sqlalchemy import text

with engine.connect() as conn:

    # Users columns
    for col_name, col_type in [
        ("plan",                   "VARCHAR DEFAULT 'free'"),
        ("stripe_customer_id",     "VARCHAR"),
        ("stripe_subscription_id", "VARCHAR"),
        ("plan_expires_at",        "DATETIME"),
    ]:
        try:
            conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
            conn.commit()
            print(f"OK: users.{col_name}")
        except:
            print(f"SKIP: users.{col_name}")

    # Journal columns
    for col_name, col_type in [
        ("entry_date",      "DATETIME"),
        ("exit_date",       "DATETIME"),
        ("trade_direction", "VARCHAR"),
        ("exit_price",      "FLOAT"),
        ("stop_loss",       "FLOAT"),
        ("take_profit",     "FLOAT"),
        ("lot_size",        "FLOAT"),
        ("profit_loss",     "FLOAT"),
        ("emotional_state", "VARCHAR"),
        ("strategy_used",   "VARCHAR"),
        ("lessons_learned", "TEXT"),
        ("ai_feedback",     "TEXT"),
    ]:
        try:
            conn.execute(text(f"ALTER TABLE journal_entries ADD COLUMN {col_name} {col_type}"))
            conn.commit()
            print(f"OK: journal_entries.{col_name}")
        except:
            print(f"SKIP: journal_entries.{col_name}")

    # Backfill existing rows
    conn.execute(text("UPDATE journal_entries SET entry_date = date WHERE entry_date IS NULL"))
    conn.execute(text("UPDATE journal_entries SET profit_loss = result WHERE profit_loss IS NULL"))
    conn.execute(text("UPDATE journal_entries SET trade_direction = direction WHERE trade_direction IS NULL"))
    conn.commit()
    print("Backfill done")

    # Subscriptions table
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            stripe_subscription_id VARCHAR,
            stripe_customer_id VARCHAR,
            plan VARCHAR DEFAULT 'free',
            status VARCHAR DEFAULT 'active',
            current_period_start DATETIME,
            current_period_end DATETIME,
            canceled_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """))
    conn.commit()
    print("Subscriptions table ready")

print("Migration complete. Restart your backend.")