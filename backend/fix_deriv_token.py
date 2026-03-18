"""
Run this once to update the stored Deriv API token in the database.
Usage: python fix_deriv_token.py
"""
import os, sys
sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv()

import psycopg2

DB_URL = os.getenv("DATABASE_URL", "postgresql://rga_user:password123@localhost:5432/risk_guardian")
NEW_TOKEN = os.getenv("DERIV_TOKEN", "TF08qMdvewSeFAJ")

# Parse connection string
import re
m = re.match(r"postgresql://([^:]+):([^@]+)@([^:/]+):(\d+)/(.+)", DB_URL)
if not m:
    print(f"❌ Could not parse DATABASE_URL: {DB_URL}")
    sys.exit(1)

user, password, host, port, dbname = m.groups()

print(f"Connecting to {host}:{port}/{dbname} as {user}...")
conn = psycopg2.connect(host=host, port=int(port), dbname=dbname, user=user, password=password)
cur  = conn.cursor()

# Show all accounts first
cur.execute("SELECT id, account_number, broker_name, server, encrypted_password FROM trading_accounts;")
rows = cur.fetchall()
print(f"\nFound {len(rows)} account(s):")
for row in rows:
    print(f"  id={row[0]} login={row[1]} broker={row[2]} server={row[3]} pwd={str(row[4])[:20]}...")

# Update all Deriv accounts
cur.execute("""
    UPDATE trading_accounts
    SET encrypted_password = %s
    WHERE 
        LOWER(account_number::text) LIKE 'cr%%'
        OR LOWER(account_number::text) LIKE 'vr%%'
        OR LOWER(server) LIKE '%%deriv%%'
        OR LOWER(broker_name) LIKE '%%deriv%%'
""", (NEW_TOKEN,))

updated = cur.rowcount
conn.commit()
cur.close()
conn.close()

print(f"\n✅ Updated {updated} Deriv account(s) with token: {NEW_TOKEN[:8]}...")
print("Restart your backend now.")



