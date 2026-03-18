"""
email_service.py
Core SMTP email sender for RiskGuardian.
Handles all outbound email via Gmail (or any SMTP provider).
"""

import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# ── Config from .env ──────────────────────────────────────────
SMTP_HOST       = os.getenv("SMTP_HOST",       "smtp.gmail.com")
SMTP_PORT       = int(os.getenv("SMTP_PORT",   "587"))
SMTP_USER       = os.getenv("SMTP_USER",       "")
SMTP_PASSWORD   = os.getenv("SMTP_PASSWORD",   "")
EMAIL_FROM      = os.getenv("EMAIL_FROM",      SMTP_USER)
EMAIL_FROM_NAME = os.getenv("EMAIL_FROM_NAME", "RiskGuardian")
FRONTEND_URL    = os.getenv("FRONTEND_URL",    "http://localhost:3000")


# ══════════════════════════════════════════════════════════════
# CORE SENDER
# ══════════════════════════════════════════════════════════════

def send_email(
    to_email:  str,
    subject:   str,
    html_body: str,
    text_body: Optional[str] = None,
) -> bool:
    """
    Send an HTML email via SMTP.
    Returns True on success, False on failure.
    """
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.warning("Email not configured — set SMTP_USER and SMTP_PASSWORD in .env")
        return False

    try:
        msg            = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = formataddr((EMAIL_FROM_NAME, EMAIL_FROM))
        msg["To"]      = to_email

        plain = text_body or "Please view this email in an HTML-capable email client."
        msg.attach(MIMEText(plain, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(EMAIL_FROM, to_email, msg.as_string())

        logger.info(f"✅ Email sent to {to_email}: {subject}")
        return True

    except smtplib.SMTPAuthenticationError:
        logger.error("❌ SMTP auth failed — check SMTP_USER and SMTP_PASSWORD in .env")
        return False
    except smtplib.SMTPException as e:
        logger.error(f"❌ SMTP error sending to {to_email}: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Unexpected error sending email to {to_email}: {e}")
        return False


# ══════════════════════════════════════════════════════════════
# EMAIL 1 — WELCOME  (with optional Telegram connect link)
# ══════════════════════════════════════════════════════════════

def send_welcome_email(to_email: str, username: str) -> bool:
    """
    Legacy call — sends welcome email without a Telegram CTA.
    Kept for backwards compatibility; prefer send_welcome_email_with_telegram.
    """
    from app.emails.email_templates import get_welcome_email
    subject, html = get_welcome_email(username, FRONTEND_URL)
    return send_email(to_email, subject, html)


def send_welcome_email_with_telegram(
    to_email:      str,
    username:      str,
    frontend_url:  str = "",
    telegram_link: str = "",
) -> bool:
    """
    Welcome email with a personal Telegram connect button baked in.
    Called from auth.py register() in a background thread:

        from app.routes.telegram import generate_connect_link
        from app.emails.email_service import send_welcome_email_with_telegram

        tg_link = generate_connect_link(user.id)
        threading.Thread(
            target=send_welcome_email_with_telegram,
            args=(user.email, user.username, FRONTEND_URL, tg_link),
            daemon=True,
        ).start()
    """
    from app.emails.email_templates import get_welcome_email
    url     = frontend_url or FRONTEND_URL
    subject, html = get_welcome_email(username, url, telegram_link)
    return send_email(to_email, subject, html)


# ══════════════════════════════════════════════════════════════
# EMAIL 2 — DAY 3 NUDGE
# ══════════════════════════════════════════════════════════════

def send_day3_nudge_email(to_email: str, username: str) -> bool:
    from app.emails.email_templates import get_day3_nudge_email
    subject, html = get_day3_nudge_email(username, FRONTEND_URL)
    return send_email(to_email, subject, html)


# ══════════════════════════════════════════════════════════════
# EMAIL 3 — DAY 7 UPGRADE PUSH
# ══════════════════════════════════════════════════════════════

def send_day7_upgrade_email(to_email: str, username: str) -> bool:
    from app.emails.email_templates import get_day7_upgrade_email
    subject, html = get_day7_upgrade_email(username, FRONTEND_URL)
    return send_email(to_email, subject, html)


# ══════════════════════════════════════════════════════════════
# EMAIL 4 — WEEKLY DIGEST
# ══════════════════════════════════════════════════════════════

def send_weekly_digest_email(
    to_email: str,
    username: str,
    stats:    dict,
) -> bool:
    from app.emails.email_templates import get_weekly_digest_email
    subject, html = get_weekly_digest_email(username, stats, FRONTEND_URL)
    return send_email(to_email, subject, html)


# ══════════════════════════════════════════════════════════════
# EMAIL 5 — TRIAL STARTED  (with optional Telegram connect link)
# ══════════════════════════════════════════════════════════════

def send_trial_started_email(
    to_email:      str,
    username:      str,
    days:          int = 7,
    telegram_link: str = "",
) -> bool:
    """
    Sent when a user activates a Pro trial.
    Pass telegram_link to include a Telegram connect CTA in the email.

    Usage when user starts a trial:
        from app.routes.telegram import generate_connect_link
        tg_link = generate_connect_link(user.id) if not user.telegram_chat_id else ""
        send_trial_started_email(user.email, user.username, days=7, telegram_link=tg_link)
    """
    from app.emails.email_templates import get_trial_started_email
    subject, html = get_trial_started_email(username, days, FRONTEND_URL, telegram_link)
    return send_email(to_email, subject, html)


# ══════════════════════════════════════════════════════════════
# EMAIL 6 — TRIAL EXPIRED
# ══════════════════════════════════════════════════════════════

def send_trial_expired_email(to_email: str, username: str) -> bool:
    from app.emails.email_templates import get_trial_expired_email
    subject, html = get_trial_expired_email(username, FRONTEND_URL)
    return send_email(to_email, subject, html)



