"""
Uses requests instead of httpx — proven to work on this machine.
Usage: python send_test_alert.py 5180705881
"""
import sys, os, requests
from dotenv import load_dotenv

load_dotenv(dotenv_path="backend/.env")
load_dotenv(dotenv_path=".env")

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")

if not BOT_TOKEN:
    print("❌ TELEGRAM_BOT_TOKEN not found in .env!")
    exit(1)

if len(sys.argv) < 2:
    print("Usage: python send_test_alert.py YOUR_CHAT_ID")
    exit(1)

CHAT_ID = sys.argv[1]
print(f"📡 Sending to chat ID: {CHAT_ID}")
print(f"   Token: {BOT_TOKEN[:25]}...")

message = """🛡️ <b>RiskGuardian — Live Alert Test</b>

✅ Your Telegram alerts are working perfectly!

Here's what you'll receive in real trading:

🔴 <b>Kill Switch</b> — when auto-lock fires
⚠️ <b>80% Warning</b> — danger zone approaching
🟡 <b>50% Warning</b> — halfway to daily limit
🔄 <b>Cooldown Lock</b> — consecutive loss protection
😤 <b>Revenge Trade</b> — emotional trade detected
📊 <b>Trade Closed</b> — every P&amp;L result (Pro)
📅 <b>Daily Summary</b> — end of day recap (Pro)
🏆 <b>Prop Firm Alert</b> — challenge protection (Pro)

Stay disciplined. RiskGuardian is watching. 💪

— RiskGuardian"""

r = requests.post(
    f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
    json={
        "chat_id":                  CHAT_ID,
        "text":                     message,
        "parse_mode":               "HTML",
        "disable_web_page_preview": True,
    },
    timeout=30,
)

data = r.json()

if data.get("ok"):
    print()
    print("✅ SUCCESS! Check your Telegram now!")
    print(f"   Message ID: {data['result']['message_id']}")
    print()
    print(f"💾 Your Chat ID to save: {CHAT_ID}")
    print()
    print("   Run this in your SQLite DB to activate live alerts:")
    print(f"   UPDATE users SET telegram_chat_id = '{CHAT_ID}' WHERE username = 'your_username';")
else:
    print(f"\n❌ Telegram error: {data}")
    code = data.get("error_code")
    desc = data.get("description", "")
    if "chat not found" in desc or code == 400:
        print("👉 Open Telegram → find your bot → send it 'hi' first, then retry")
    elif "Unauthorized" in desc or code == 401:
        print("👉 Your BOT_TOKEN is wrong — check backend/.env")
    elif "bot was blocked" in desc:
        print("👉 Unblock the bot in Telegram → tap bot name → Unblock")


