"""
app/routes/admin.py
Enhanced admin dashboard backend — SQLite compatible.
Adds: trial analytics, conversion rates, referral system, onboarding tracking.
"""

import os
import secrets
import string
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database.database import get_db
from app.models.user import User
from app.services.auth_service import get_current_user

router = APIRouter()


# ══════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════

def _require_admin(current_user: User = Depends(get_current_user)):
    if current_user.plan not in ("enterprise", "founder"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def _gen_referral_code(username: str) -> str:
    suffix = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(4))
    base   = username[:4].upper().replace(" ", "")
    return f"{base}{suffix}"


def _column_exists(db: Session, table: str, column: str) -> bool:
    """SQLite-compatible column existence check using PRAGMA."""
    try:
        rows = db.execute(text(f"PRAGMA table_info({table})")).fetchall()
        return any(row[1] == column for row in rows)
    except Exception:
        return False


def _table_exists(db: Session, table: str) -> bool:
    """Check if a table exists in SQLite."""
    try:
        result = db.execute(text(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=:t"
        ), {"t": table}).scalar()
        return result > 0
    except Exception:
        return False


# ══════════════════════════════════════════════════════════════
# OVERVIEW
# ══════════════════════════════════════════════════════════════

@router.get("/overview")
def admin_overview(db: Session = Depends(get_db)):
    now      = datetime.utcnow()
    week_ago = (now - timedelta(days=7)).isoformat()
    now_iso  = now.isoformat()
    h24_iso  = (now + timedelta(hours=24)).isoformat()
    h48_iso  = (now + timedelta(hours=48)).isoformat()

    total_users      = db.execute(text("SELECT COUNT(*) FROM users")).scalar() or 0
    visitors         = db.execute(text("SELECT COUNT(*) FROM visitors")).scalar() \
                       if _table_exists(db, "visitors") else 0
    trading_accounts = db.execute(text("SELECT COUNT(*) FROM trading_accounts")).scalar() \
                       if _table_exists(db, "trading_accounts") else 0
    risk_alerts      = db.execute(text("SELECT COUNT(*) FROM rule_trigger_logs")).scalar() \
                       if _table_exists(db, "rule_trigger_logs") else 0

    # ── Trial stats (SQLite: compare ISO strings) ────────────
    active_trials = db.execute(text("""
        SELECT COUNT(*) FROM users
        WHERE trial_ends_at > :now
        AND plan = 'pro'
        AND trial_used = 1
    """), {"now": now_iso}).scalar() or 0

    expiring_24h = db.execute(text("""
        SELECT COUNT(*) FROM users
        WHERE trial_ends_at > :now
        AND trial_ends_at <= :h24
        AND plan = 'pro'
        AND trial_used = 1
    """), {"now": now_iso, "h24": h24_iso}).scalar() or 0

    expiring_48h = db.execute(text("""
        SELECT COUNT(*) FROM users
        WHERE trial_ends_at > :now
        AND trial_ends_at <= :h48
        AND plan = 'pro'
        AND trial_used = 1
    """), {"now": now_iso, "h48": h48_iso}).scalar() or 0

    expired_trials = db.execute(text("""
        SELECT COUNT(*) FROM users
        WHERE trial_used = 1
        AND (trial_ends_at IS NULL OR trial_ends_at <= :now)
        AND plan = 'free'
    """), {"now": now_iso}).scalar() or 0

    # ── Conversion ───────────────────────────────────────────
    paid_users = db.execute(text("""
        SELECT COUNT(*) FROM users
        WHERE plan IN ('starter', 'pro', 'enterprise')
        AND (trial_used = 0 OR trial_used IS NULL
             OR subscription_status = 'active')
    """)).scalar() or 0

    trial_to_paid = db.execute(text("""
        SELECT COUNT(*) FROM users
        WHERE trial_used = 1
        AND plan IN ('starter', 'pro', 'enterprise')
        AND subscription_status = 'active'
    """)).scalar() or 0

    conversion_rate = round(
        (trial_to_paid / expired_trials * 100) if expired_trials > 0 else 0, 1
    )

    # ── Plan breakdown ───────────────────────────────────────
    plan_rows = db.execute(text(
        "SELECT plan, COUNT(*) FROM users GROUP BY plan"
    )).fetchall()
    plans = {row[0]: row[1] for row in plan_rows}

    # ── New users this week ──────────────────────────────────
    new_this_week = db.execute(text("""
        SELECT COUNT(*) FROM users WHERE created_at >= :week_ago
    """), {"week_ago": week_ago}).scalar() or 0

    # ── Telegram ─────────────────────────────────────────────
    telegram_connected = db.execute(text("""
        SELECT COUNT(*) FROM users WHERE telegram_chat_id IS NOT NULL
    """)).scalar() or 0

    # ── Onboarding ───────────────────────────────────────────
    onboarding_complete = db.execute(text("""
        SELECT COUNT(*) FROM users WHERE onboarding_completed = 1
    """)).scalar() if _column_exists(db, "users", "onboarding_completed") else 0

    # ── Referrals ────────────────────────────────────────────
    total_referrals = db.execute(text("""
        SELECT COUNT(*) FROM users WHERE referred_by IS NOT NULL
    """)).scalar() if _column_exists(db, "users", "referred_by") else 0

    return {
        "total_users":         total_users,
        "visitors_today":      visitors,
        "trading_accounts":    trading_accounts,
        "risk_alerts":         risk_alerts,
        "new_this_week":       new_this_week,
        "telegram_connected":  telegram_connected,
        "active_trials":       active_trials,
        "expiring_24h":        expiring_24h,
        "expiring_48h":        expiring_48h,
        "expired_trials":      expired_trials,
        "paid_users":          paid_users,
        "trial_to_paid":       trial_to_paid,
        "conversion_rate":     conversion_rate,
        "plans":               plans,
        "onboarding_complete": onboarding_complete,
        "total_referrals":     total_referrals,
    }


# ══════════════════════════════════════════════════════════════
# TRIAL USERS
# ══════════════════════════════════════════════════════════════

@router.get("/trial-users")
def trial_users(db: Session = Depends(get_db)):
    now     = datetime.utcnow()
    now_iso = now.isoformat()

    rows = db.execute(text("""
        SELECT id, username, email, plan, trial_ends_at,
               telegram_chat_id, created_at
        FROM users
        WHERE trial_used = 1
        AND trial_ends_at > :now
        AND plan = 'pro'
        ORDER BY trial_ends_at ASC
    """), {"now": now_iso}).fetchall()

    result = []
    for r in rows:
        trial_ends = datetime.fromisoformat(r[4]) if r[4] else None
        hours_left = max(0, int((trial_ends - now).total_seconds() / 3600)) if trial_ends else 0
        joined     = r[6] if isinstance(r[6], str) else (r[6].isoformat() if r[6] else None)
        result.append({
            "id":            r[0],
            "username":      r[1],
            "email":         r[2],
            "plan":          r[3],
            "trial_ends_at": r[4],
            "hours_left":    hours_left,
            "telegram":      bool(r[5]),
            "joined":        joined,
        })
    return result


# ══════════════════════════════════════════════════════════════
# ALL USERS
# ══════════════════════════════════════════════════════════════

@router.get("/users")
def all_users(db: Session = Depends(get_db)):
    now  = datetime.utcnow()
    rows = db.execute(text("""
        SELECT id, username, email, plan, subscription_status,
               trial_used, trial_ends_at, telegram_chat_id,
               created_at, is_active
        FROM users
        ORDER BY created_at DESC
        LIMIT 100
    """)).fetchall()

    result = []
    for r in rows:
        trial_ends   = datetime.fromisoformat(r[6]) if r[6] else None
        trial_active = bool(r[5] and trial_ends and trial_ends > now)
        hours_left   = max(0, int((trial_ends - now).total_seconds() / 3600)) if trial_active and trial_ends else 0
        joined       = r[8] if isinstance(r[8], str) else (r[8].isoformat() if r[8] else None)
        result.append({
            "id":                  r[0],
            "username":            r[1],
            "email":               r[2],
            "plan":                r[3],
            "subscription_status": r[4],
            "trial_active":        trial_active,
            "hours_left":          hours_left,
            "telegram":            bool(r[7]),
            "joined":              joined,
            "active":              bool(r[9]),
        })
    return result


# ══════════════════════════════════════════════════════════════
# SIGNUPS CHART — last 30 days
# ══════════════════════════════════════════════════════════════

@router.get("/signups-chart")
def signups_chart(db: Session = Depends(get_db)):
    cutoff = (datetime.utcnow() - timedelta(days=30)).isoformat()
    rows   = db.execute(text("""
        SELECT DATE(created_at) as day, COUNT(*) as count
        FROM users
        WHERE created_at >= :cutoff
        GROUP BY DATE(created_at)
        ORDER BY day ASC
    """), {"cutoff": cutoff}).fetchall()
    return [{"day": str(r[0]), "signups": r[1]} for r in rows]


# ══════════════════════════════════════════════════════════════
# REVENUE CHART — last 30 days
# ══════════════════════════════════════════════════════════════

@router.get("/revenue-chart")
def revenue_chart(db: Session = Depends(get_db)):
    if not _table_exists(db, "subscriptions"):
        return []

    plan_prices = {"starter": 19, "pro": 49, "enterprise": 149}
    cutoff      = (datetime.utcnow() - timedelta(days=30)).isoformat()

    rows = db.execute(text("""
        SELECT DATE(created_at) as day, plan, COUNT(*) as count
        FROM subscriptions
        WHERE created_at >= :cutoff
        AND status = 'active'
        GROUP BY DATE(created_at), plan
        ORDER BY day ASC
    """), {"cutoff": cutoff}).fetchall()

    daily: dict = {}
    for r in rows:
        day = str(r[0])
        daily[day] = daily.get(day, 0) + plan_prices.get(r[1], 0) * r[2]

    return [{"day": d, "revenue": v} for d, v in sorted(daily.items())]


# ══════════════════════════════════════════════════════════════
# ONBOARDING TRACKING
# ══════════════════════════════════════════════════════════════

@router.post("/onboarding/complete")
def mark_onboarding_complete(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    try:
        now_iso = datetime.utcnow().isoformat()
        db.execute(text("""
            UPDATE users
            SET onboarding_completed = 1,
                onboarding_completed_at = :now
            WHERE id = :uid
        """), {"now": now_iso, "uid": current_user.id})
        db.commit()
    except Exception:
        pass
    return {"ok": True}


@router.get("/onboarding/stats")
def onboarding_stats(db: Session = Depends(get_db)):
    total = db.execute(text("SELECT COUNT(*) FROM users")).scalar() or 1

    mt5_done = db.execute(text("SELECT COUNT(*) FROM trading_accounts")).scalar() \
               if _table_exists(db, "trading_accounts") else 0

    risk_done = db.execute(text("""
        SELECT COUNT(DISTINCT user_id) FROM risk_rules WHERE is_active = 1
    """)).scalar() if _table_exists(db, "risk_rules") else 0

    journal_done = db.execute(text("""
        SELECT COUNT(DISTINCT user_id) FROM journal_entries
    """)).scalar() if _table_exists(db, "journal_entries") else 0

    telegram_done = db.execute(text("""
        SELECT COUNT(*) FROM users WHERE telegram_chat_id IS NOT NULL
    """)).scalar() or 0

    def pct(n): return round(n / total * 100)

    return {
        "total_users": total,
        "steps": [
            {"step": "Connect MT5",         "done": mt5_done,      "pct": pct(mt5_done)},
            {"step": "Set Risk Limits",     "done": risk_done,     "pct": pct(risk_done)},
            {"step": "First Journal Entry", "done": journal_done,  "pct": pct(journal_done)},
            {"step": "Connect Telegram",    "done": telegram_done, "pct": pct(telegram_done)},
        ],
    }


# ══════════════════════════════════════════════════════════════
# REFERRAL SYSTEM
# ══════════════════════════════════════════════════════════════

@router.get("/referral/my-code")
def get_my_referral_code(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    if not _column_exists(db, "users", "referral_code"):
        return {"referral_code": None, "message": "Run migration first"}

    row = db.execute(text("""
        SELECT referral_code, referral_count FROM users WHERE id = :uid
    """), {"uid": current_user.id}).fetchone()

    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

    if row and row[0]:
        return {
            "referral_code":  row[0],
            "referral_count": row[1] or 0,
            "share_url":      f"{FRONTEND_URL}?ref={row[0]}",
        }

    code = _gen_referral_code(current_user.username)
    db.execute(text("""
        UPDATE users SET referral_code = :code WHERE id = :uid
    """), {"code": code, "uid": current_user.id})
    db.commit()

    return {
        "referral_code":  code,
        "referral_count": 0,
        "share_url":      f"{FRONTEND_URL}?ref={code}",
    }


@router.get("/referral/stats")
def referral_stats(db: Session = Depends(get_db)):
    if not _column_exists(db, "users", "referral_code"):
        return {"top_referrers": [], "total_referrals": 0}

    total = db.execute(text("""
        SELECT COUNT(*) FROM users WHERE referred_by IS NOT NULL
    """)).scalar() or 0

    top = db.execute(text("""
        SELECT username, referral_code, referral_count, plan
        FROM users
        WHERE referral_count > 0
        ORDER BY referral_count DESC
        LIMIT 10
    """)).fetchall()

    return {
        "total_referrals": total,
        "top_referrers": [
            {"username": r[0], "code": r[1], "count": r[2], "plan": r[3]}
            for r in top
        ],
    }


# ══════════════════════════════════════════════════════════════
# EXISTING ENDPOINTS
# ══════════════════════════════════════════════════════════════

@router.get("/live-trades")
def live_trades(db: Session = Depends(get_db)):
    if not _table_exists(db, "journal_entries"):
        return []
    trades = db.execute(text("""
        SELECT symbol, volume, profit_loss
        FROM journal_entries
        ORDER BY id DESC LIMIT 10
    """)).fetchall()
    return [{"symbol": t[0], "volume": t[1], "profit": t[2] or 0} for t in trades]


@router.get("/active-accounts")
def active_accounts(db: Session = Depends(get_db)):
    if not _table_exists(db, "trading_accounts"):
        return []
    accounts = db.execute(text("""
        SELECT account_number, broker_name FROM trading_accounts LIMIT 10
    """)).fetchall()
    return [{"login": a[0], "broker": a[1]} for a in accounts]


@router.get("/risk-violations")
def risk_violations(db: Session = Depends(get_db)):
    if not _table_exists(db, "rule_trigger_logs"):
        return []
    violations = db.execute(text("""
        SELECT rule_name FROM rule_trigger_logs ORDER BY id DESC LIMIT 10
    """)).fetchall()
    return [{"rule": v[0]} for v in violations]
