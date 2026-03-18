"""
Run this from your backend folder:
  python fix_both_errors.py

Fixes:
1. Adds trial columns to users table
2. Shows which .env file is actually being loaded
"""
import os, sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# ── Fix 1: Show actual Stripe key being used ──────────────
print("=" * 60)
print("STRIPE KEY CHECK")
print("=" * 60)

# Check all possible .env locations
import pathlib
for env_path in ['.env', '../.env', 'app/.env']:
    p = pathlib.Path(env_path)
    if p.exists():
        print(f"\n📄 Found: {p.resolve()}")
        for line in p.read_text().splitlines():
            if 'STRIPE_SECRET' in line:
                print(f"   {line[:60]}...")
    else:
        print(f"   ❌ Not found: {env_path}")

# What's actually loaded in memory
stripe_key = os.environ.get('STRIPE_SECRET_KEY', 'NOT SET')
print(f"\n🔑 Key in memory: {stripe_key[:30]}...{stripe_key[-6:]}")

# ── Fix 2: Add trial columns ──────────────────────────────
print("\n" + "=" * 60)
print("ADDING TRIAL COLUMNS")
print("=" * 60)

try:
    from dotenv import load_dotenv
    load_dotenv(override=True)
    from app.database.database import SessionLocal
    from sqlalchemy import text

    db = SessionLocal()
    columns = [
        ("trial_ends_at", "DATETIME DEFAULT NULL"),
        ("trial_used",    "BOOLEAN DEFAULT 0 NOT NULL"),
        ("trial_plan",    "VARCHAR(20) DEFAULT 'pro'"),
    ]

    # Detect SQLite vs Postgres
    db_url = os.environ.get('DATABASE_URL', '')
    is_sqlite = 'sqlite' in db_url or not db_url

    if is_sqlite:
        result   = db.execute(text("PRAGMA table_info(users)"))
        existing = {row[1] for row in result.fetchall()}
    else:
        result   = db.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name='users'"
        ))
        existing = {row[0] for row in result.fetchall()}

    print(f"Existing columns: {existing}")

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
    print("\n✅ Done!")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback; traceback.print_exc()


