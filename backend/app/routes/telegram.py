"""
backend/app/routes/telegram.py
Handles Telegram bot connection for RiskGuardian users.

Auto-connect flow:
  1. generate_connect_link(user_id)  →  t.me/RiskGuardianBot?start=<b64_payload>
  2. User clicks → presses START in Telegram
  3. Webhook fires → decode_start_payload() → save chat_id → send confirmation
  4. User is connected with zero manual steps
"""

import os
import base64
import json
import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User
from app.services.auth_service import get_current_user

logger = logging.getLogger(__name__)

router       = APIRouter()
BOT_TOKEN    = os.getenv("TELEGRAM_BOT_TOKEN",    "")
BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "RiskGuardianBot")


# ════════════════════════════════════════════════════════════════
# HELPERS
# ════════════════════════════════════════════════════════════════

def generate_connect_link(user_id: int) -> str:
    """
    Build the personal deep-link a user clicks to connect Telegram.
    Payload embeds user_id + timestamp for secure matching on webhook.
    """
    payload_json = json.dumps({
        "uid": user_id,
        "ts":  int(datetime.now(timezone.utc).timestamp()),
    })
    encoded = base64.urlsafe_b64encode(payload_json.encode()).decode().rstrip("=")
    return f"https://t.me/{BOT_USERNAME}?start={encoded}"


def decode_start_payload(raw: str) -> dict | None:
    """Decode base64 payload from /start command. Returns {"uid", "ts"} or None."""
    try:
        padded = raw + "=" * (-len(raw) % 4)
        data   = base64.urlsafe_b64decode(padded).decode()
        return json.loads(data)
    except Exception:
        try:
            padded = raw + "=" * (-len(raw) % 4)
            uid    = int(base64.urlsafe_b64decode(padded).decode())
            return {"uid": uid, "ts": 0}
        except Exception:
            return None


async def _send(chat_id: str, text: str) -> bool:
    """
    Send a Telegram message. Returns True on success, False on any failure.
    Never raises — callers can safely ignore the return value.
    """
    if not BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN not set — skipping send")
        return False
    if not chat_id:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
                json={
                    "chat_id":    chat_id,
                    "text":       text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                },
            )
            if r.status_code != 200:
                logger.warning("Telegram send HTTP %s: %s", r.status_code, r.text[:200])
                return False
            return True
    except Exception as exc:
        logger.error("Telegram send failed: %s", exc)
        return False


# ════════════════════════════════════════════════════════════════
# ROUTES
# ════════════════════════════════════════════════════════════════

@router.get("/telegram/status")
async def get_telegram_status(current_user: User = Depends(get_current_user)):
    """Quick status check — called by the Settings page on load."""
    return {
        "connected": bool(current_user.telegram_chat_id),
        "chat_id":   current_user.telegram_chat_id,
    }


@router.get("/telegram/connect-link")
async def get_connect_link(current_user: User = Depends(get_current_user)):
    """
    Returns the personal deep-link + current connection status.
    Called by TelegramPanel on mount.
    """
    link = generate_connect_link(current_user.id)
    return {
        "link":         link,
        "bot_username": BOT_USERNAME,
        "connected":    bool(current_user.telegram_chat_id),
        "chat_id":      current_user.telegram_chat_id,
    }


@router.post("/telegram/webhook")
async def telegram_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Telegram pushes all bot updates here.

    Handles:
        /start <payload>  →  auto-connect user
        /start            →  generic welcome
        /stop             →  disconnect user + sync Settings toggle
        /status           →  show plan & connection info
    """
    try:
        body = await request.json()
    except Exception:
        return {"ok": True}

    message = body.get("message", {})
    if not message:
        return {"ok": True}

    chat_id = str(message.get("chat", {}).get("id", ""))
    text    = (message.get("text") or "").strip()

    if not chat_id:
        return {"ok": True}

    # ── /start ──────────────────────────────────────────────
    if text.startswith("/start"):
        parts   = text.split(" ", 1)
        raw     = parts[1].strip() if len(parts) > 1 else None
        payload = decode_start_payload(raw) if raw else None

        if payload and "uid" in payload:
            user = db.query(User).filter(User.id == payload["uid"]).first()
            if user:
                user.telegram_chat_id = chat_id
                db.commit()
                logger.info("Telegram connected: user_id=%s chat_id=%s", user.id, chat_id)

                await _send(chat_id, (
                    f"✅ <b>Telegram Connected!</b>\n\n"
                    f"Hey {user.username}! Your RiskGuardian alerts are now live.\n\n"
                    f"You'll receive:\n"
                    f"• 🔴 Kill switch alerts\n"
                    f"• ⚠️ Risk warnings (50% and 80%)\n"
                    f"• 📊 Trade closed P&amp;L updates\n"
                    f"• 📅 Daily trading summaries\n\n"
                    f"Type /stop to unsubscribe anytime.\n\n"
                    f"— RiskGuardian 🛡️"
                ))
                return {"ok": True}

        # No valid payload — generic welcome
        await _send(chat_id, (
            "👋 Welcome to <b>RiskGuardian</b>!\n\n"
            "To connect your account, click the personal link in your dashboard:\n"
            "<b>Settings → Notifications → Telegram Connection</b>\n\n"
            "— RiskGuardian 🛡️"
        ))
        return {"ok": True}

    # ── /stop ────────────────────────────────────────────────
    if text == "/stop":
        user = db.query(User).filter(User.telegram_chat_id == chat_id).first()
        if user:
            # ✅ Clear chat_id AND sync the Telegram toggle in Settings
            user.telegram_chat_id = None
            # If the user model has a telegram toggle setting, clear it too
            if hasattr(user, "alert_telegram"):
                user.alert_telegram = False
            db.commit()
            await _send(chat_id, (
                "✅ <b>Disconnected</b>\n\n"
                "You've been unsubscribed from RiskGuardian alerts.\n"
                "Your Settings page has been updated automatically.\n\n"
                "Reconnect anytime from Settings → Notifications."
            ))
        else:
            await _send(chat_id, "You weren't subscribed to any RiskGuardian alerts.")
        return {"ok": True}

    # ── /status ──────────────────────────────────────────────
    if text == "/status":
        user = db.query(User).filter(User.telegram_chat_id == chat_id).first()
        if user:
            trial_info = ""
            if user.trial_ends_at and user.trial_ends_at > datetime.now(timezone.utc).replace(tzinfo=None):
                diff      = user.trial_ends_at - datetime.utcnow()
                days_left = diff.days
                trial_info = f"\nTrial:    <b>{days_left} day(s) left</b>"

            await _send(chat_id, (
                f"📊 <b>Your RiskGuardian Status</b>\n\n"
                f"Username: <b>{user.username}</b>\n"
                f"Plan:     <b>{user.plan.upper()}</b>{trial_info}\n"
                f"Alerts:   ✅ Active\n\n"
                f"Stay disciplined! 💪"
            ))
        else:
            await _send(chat_id, (
                "No RiskGuardian account linked to this chat.\n"
                "Connect from Settings → Notifications → Telegram."
            ))
        return {"ok": True}

    return {"ok": True}


@router.post("/telegram/test")
async def send_test_alert(current_user: User = Depends(get_current_user)):
    """
    Send a test alert to the user's connected Telegram chat.
    ✅ Fails gracefully — returns clear error messages instead of crashing.
    """
    if not current_user.telegram_chat_id:
        raise HTTPException(
            status_code=400,
            detail="Telegram not connected. Connect first from Settings → Notifications.",
        )

    if not BOT_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="Telegram bot is not configured. Contact support.",
        )

    ok = await _send(current_user.telegram_chat_id, (
        f"🛡️ <b>Test Alert — RiskGuardian</b>\n\n"
        f"Hey {current_user.username}! This is a test alert. ✅\n\n"
        f"Your Telegram is connected and working perfectly.\n\n"
        f"You'll receive real-time alerts for:\n"
        f"• 🔴 Kill switch events\n"
        f"• ⚠️ Risk limit warnings (50% &amp; 80%)\n"
        f"• 📊 Trade closed P&amp;L updates\n"
        f"• 📅 Daily summaries\n\n"
        f"— RiskGuardian"
    ))

    if not ok:
        # ✅ Graceful failure — tells user exactly what to check
        raise HTTPException(
            status_code=502,
            detail=(
                "Could not deliver the test alert. "
                "This usually means the bot token is misconfigured or Telegram is unreachable. "
                "Check TELEGRAM_BOT_TOKEN in your .env file."
            ),
        )

    return {"message": "Test alert sent! Check your Telegram."}


@router.delete("/telegram/disconnect")
async def disconnect_telegram(
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """Remove the user's saved Telegram chat_id, stopping all alerts."""
    if current_user.telegram_chat_id:
        await _send(current_user.telegram_chat_id, (
            "🔕 <b>Telegram Disconnected</b>\n\n"
            "You've disconnected your RiskGuardian Telegram alerts.\n"
            "Reconnect anytime from Settings → Notifications."
        ))
    current_user.telegram_chat_id = None
    db.commit()
    return {"message": "Telegram disconnected"}


