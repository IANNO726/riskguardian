"""
Saves your Telegram chat ID to your user account in the DB.
Usage: python save_chat_id.py 5180705881
"""
import sys, os, sqlite3

if len(sys.argv) < 2:
    print("Usage: python save_chat_id.py YOUR_CHAT_ID")
    exit(1)

CHAT_ID = sys.argv[1]

# Find the database
DB_PATHS = [
    "riskguardian.db",
    "backend/riskguardian.db",
    "app/riskguardian.db",
]

db_path = None
for p in DB_PATHS:
    if os.path.exists(p):
        db_path = p
        break

if not db_path:
    print("❌ Could not find riskguardian.db")
    print("   Run from your backend folder")
    exit(1)

conn = sqlite3.connect(db_path)
cur  = conn.cursor()

# Show all users so you can pick the right one
cur.execute("SELECT id, username, email, plan, telegram_chat_id FROM users")
users = cur.fetchall()

print("\n👥 Your users:")
print(f"{'ID':<5} {'Username':<20} {'Email':<30} {'Plan':<12} {'Telegram'}")
print("-" * 80)
for u in users:
    tg = u[4] or "not set"
    print(f"{u[0]:<5} {u[1]:<20} {u[2]:<30} {u[3]:<12} {tg}")

print()
username = input("Enter your username to update (or press Enter for first user): ").strip()

if not username:
    target = users[0]
else:
    target = next((u for u in users if u[1] == username), None)

if not target:
    print(f"❌ User '{username}' not found")
    conn.close()
    exit(1)

cur.execute(
    "UPDATE users SET telegram_chat_id = ? WHERE id = ?",
    (CHAT_ID, target[0])
)
conn.commit()
conn.close()

print(f"\n✅ Saved! telegram_chat_id = {CHAT_ID} for user '{target[1]}'")
print("\n🎉 Live alerts are now active!")
print("   The next time your kill switch fires or risk limit is hit,")
print("   you'll receive a Telegram message instantly.")


