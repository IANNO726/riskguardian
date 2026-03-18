"""
Run this script to get your Telegram chat ID.
Place it anywhere and run: python get_chat_id.py

BEFORE running:
1. Go to Telegram, search for your bot (the one you created with @BotFather)
2. Send it ANY message (just type "hi" and send)
3. Then run this script — it will show your chat ID
"""
import httpx
import os
from dotenv import load_dotenv

# Load your .env file
load_dotenv(dotenv_path="backend/.env")
load_dotenv(dotenv_path=".env")  # fallback

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")

if not BOT_TOKEN:
    print("❌ TELEGRAM_BOT_TOKEN not found in .env file!")
    print("   Make sure backend/.env has: TELEGRAM_BOT_TOKEN=your_token")
    exit(1)

print(f"✅ Bot token found: {BOT_TOKEN[:20]}...")
print("📡 Fetching updates from Telegram...\n")

response = httpx.get(
    f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates",
    timeout=10
)

data = response.json()

if not data.get("ok"):
    print(f"❌ Telegram API error: {data}")
    exit(1)

updates = data.get("result", [])

if not updates:
    print("⚠️  No messages found!")
    print()
    print("👉 Do this first:")
    print("   1. Open Telegram on your phone or desktop")
    print(f"  2. Search for your bot by username")
    print("   3. Send it ANY message (type 'hi' and press send)")
    print("   4. Then run this script again")
    exit(1)

print("=" * 50)
for update in updates:
    msg = update.get("message") or update.get("channel_post", {})
    chat = msg.get("chat", {})
    from_user = msg.get("from", {})
    
    chat_id   = chat.get("id")
    username  = from_user.get("username", "unknown")
    first     = from_user.get("first_name", "")
    text      = msg.get("text", "")
    
    print(f"👤 From: {first} (@{username})")
    print(f"💬 Message: '{text}'")
    print(f"🆔 YOUR CHAT ID: {chat_id}")
    print("=" * 50)

print()
print("✅ Copy your chat ID above and paste it when asked!")


