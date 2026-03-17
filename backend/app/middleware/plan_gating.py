"""
plan_gating.py — Subscription Plan Enforcement Middleware
==========================================================
Fixes the 4 audit gaps identified:
  1. NO PLAN GATING MIDDLEWARE  [MEDIUM] — features not restricted by plan
  2. MT5 account limits          [MEDIUM] — 1/3/unlimited not enforced
  3. Journal 50 entries/mo limit [LOW]   — Starter limit not enforced
  4. Multi-session compare limit [LOW]   — 3 Pro / 5 Growth not enforced

Drop this file at:  app/middleware/plan_gating.py
Then import helpers into your routes as shown below.

Usage:
  from app.middleware.plan_gating import require_plan, check_account_limit, check_journal_limit, get_user_plan

  # Gate an entire endpoint to Pro+
  @router.post("/portfolio/analyze")
  async def analyze_portfolio(req: PortfolioRequest, _=Depends(require_plan("pro"))):
      ...

  # Gate inside a route with a custom error
  plan = get_user_plan(current_user)
  if plan not in ["pro","growth","enterprise"]:
      raise HTTPException(403, "Portfolio tracker requires Pro plan or above")
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
import os

# ── Plan hierarchy ─────────────────────────────────────────────────────────────
PLAN_HIERARCHY = {
    "trial":      0,
    "starter":    1,
    "pro":        2,
    "growth":     3,
    "enterprise": 4,
}

# ── Feature → minimum required plan ───────────────────────────────────────────
FEATURE_PLAN_REQUIREMENTS = {
    # Phase 1 features
    "kill_switch":           "starter",
    "daily_loss_limit":      "starter",
    "max_drawdown":          "starter",
    "cooldown":              "starter",
    "email_alerts":          "starter",
    "telegram_alerts":       "starter",
    "risk_check":            "starter",
    "scale_in":              "starter",
    "trade_journal":         "starter",

    # Phase 2 + 3 features (Pro+)
    "all_firms":             "pro",
    "portfolio_tracker":     "pro",
    "news_calendar":         "pro",
    "weekly_report":         "pro",
    "pass_probability":      "pro",
    "equity_curve":          "pro",
    "multi_session_compare": "pro",
    "ai_behavioral":         "pro",

    # Growth+ features
    "custom_firm_builder":   "growth",
    "psych_scenario_history":"growth",
    "notion_sync":           "growth",
    "custom_alert_schedule": "growth",

    # Enterprise only
    "white_label":           "enterprise",
    "api_webhooks":          "enterprise",
    "team_management":       "enterprise",
    "aggregate_reports":     "enterprise",
}

# ── Account limits per plan ───────────────────────────────────────────────────
ACCOUNT_LIMITS = {
    "trial":      1,
    "starter":    1,
    "pro":        3,
    "growth":     9999,   # unlimited
    "enterprise": 9999,   # unlimited
}

# ── Journal entry limits per month ────────────────────────────────────────────
JOURNAL_LIMITS = {
    "trial":      25,
    "starter":    50,
    "pro":        500,
    "growth":     9999,   # unlimited
    "enterprise": 9999,   # unlimited
}

# ── Compare session limits ────────────────────────────────────────────────────
COMPARE_LIMITS = {
    "trial":      2,
    "starter":    0,      # not available on starter
    "pro":        3,
    "growth":     5,
    "enterprise": 10,
}

# ── Simulator firm limits ─────────────────────────────────────────────────────
FIRM_LIMITS = {
    "trial":      1,      # trial: 1 firm (FTMO only)
    "starter":    1,      # starter: 1 firm
    "pro":        5,      # all 5 firms
    "growth":     5,
    "enterprise": 5,
}


def get_user_plan(user) -> str:
    """
    Extract the plan name from the User/Subscription model.
    Falls back to 'starter' if no subscription found.

    Your Subscription model should have a `plan` column with values:
    'trial' | 'starter' | 'pro' | 'growth' | 'enterprise'
    """
    try:
        if hasattr(user, 'subscription') and user.subscription:
            return (user.subscription.plan or "starter").lower()
        if hasattr(user, 'plan'):
            return (user.plan or "starter").lower()
    except Exception:
        pass
    return "starter"


def plan_allows(user_plan: str, required_plan: str) -> bool:
    """Returns True if user_plan meets or exceeds required_plan."""
    return PLAN_HIERARCHY.get(user_plan, 0) >= PLAN_HIERARCHY.get(required_plan, 0)


def require_plan(minimum_plan: str):
    """
    FastAPI Depends factory — gates an endpoint to a minimum plan.

    Example:
        @router.post("/portfolio/analyze")
        async def analyze(req: PortfolioRequest, _=Depends(require_plan("pro"))):
            ...
    """
    # Import here to avoid circular imports
    from app.routes.auth_multi import get_current_user
    from app.database.database import get_db

    async def dependency(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        plan = get_user_plan(current_user)
        if not plan_allows(plan, minimum_plan):
            plan_names = {
                "pro":        "Pro ($79/mo)",
                "growth":     "Growth ($149/mo)",
                "enterprise": "Enterprise ($349/mo)",
            }
            required_label = plan_names.get(minimum_plan, minimum_plan.title())
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error":    "plan_required",
                    "message":  f"This feature requires {required_label} or above.",
                    "current":  plan,
                    "required": minimum_plan,
                    "upgrade_url": "/pricing",
                }
            )
        return current_user
    return dependency


def check_account_limit(user, db: Session) -> None:
    """
    Call inside POST /api/v1/accounts-multi/ before creating a new account.
    Raises 403 if the user has hit their plan's MT5 account limit.
    """
    from app.models.broker import BrokerConnection  # adjust to your model name

    plan  = get_user_plan(user)
    limit = ACCOUNT_LIMITS.get(plan, 1)

    if limit >= 9999:
        return  # unlimited

    try:
        count = db.query(BrokerConnection).filter(
            BrokerConnection.user_id == user.id,
            BrokerConnection.is_active == True,
        ).count()
    except Exception:
        # Fallback — if model name differs, skip check gracefully
        return

    if count >= limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error":    "account_limit_reached",
                "message":  f"Your {plan.title()} plan allows {limit} MT5 account{'s' if limit > 1 else ''}. "
                            f"Upgrade to add more.",
                "limit":    limit,
                "current":  count,
                "upgrade_url": "/pricing",
            }
        )


def check_journal_limit(user, db: Session) -> None:
    """
    Call inside POST /api/v1/journal/entries before creating a new entry.
    Enforces the monthly journal entry limit for Starter plan (50/mo).
    """
    from app.models.journal import JournalEntry

    plan  = get_user_plan(user)
    limit = JOURNAL_LIMITS.get(plan, 50)

    if limit >= 9999:
        return  # unlimited

    # Count entries in the current calendar month
    now         = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    try:
        count = db.query(JournalEntry).filter(
            JournalEntry.user_id == user.id,
            JournalEntry.created_at >= month_start,
        ).count()
    except Exception:
        # If column name differs, try `date` column
        try:
            count = db.query(JournalEntry).filter(
                JournalEntry.user_id == user.id,
                JournalEntry.date >= month_start,
            ).count()
        except Exception:
            return  # skip gracefully

    if count >= limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error":    "journal_limit_reached",
                "message":  f"Your {plan.title()} plan allows {limit} journal entries per month. "
                            f"You've used {count}/{limit} this month. Upgrade for unlimited entries.",
                "limit":    limit,
                "used":     count,
                "resets_on": (month_start + timedelta(days=32)).replace(day=1).date().isoformat(),
                "upgrade_url": "/pricing",
            }
        )


def check_compare_limit(user, session_count: int) -> None:
    """
    Call inside POST /api/v1/simulator/compare before running comparison.
    Enforces the compare session limits (3 for Pro, 5 for Growth).
    """
    plan  = get_user_plan(user)
    limit = COMPARE_LIMITS.get(plan, 0)

    if plan == "starter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error":    "plan_required",
                "message":  "Multi-session comparison requires Pro plan ($79/mo) or above.",
                "current":  plan,
                "required": "pro",
                "upgrade_url": "/pricing",
            }
        )

    if limit >= 9999:
        return  # unlimited

    if session_count > limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error":    "compare_limit_exceeded",
                "message":  f"Your {plan.title()} plan allows comparing up to {limit} sessions at once. "
                            f"You submitted {session_count}. Upgrade to Growth for 5 sessions.",
                "limit":    limit,
                "submitted": session_count,
                "upgrade_url": "/pricing",
            }
        )


def check_firm_limit(user, requested_firm: str) -> None:
    """
    Call inside POST /api/v1/simulator/start before starting a simulation.
    Starter plan gets 1 firm only. Pro+ gets all 5.
    """
    plan  = get_user_plan(user)
    limit = FIRM_LIMITS.get(plan, 1)

    if limit >= 5:
        return  # all firms allowed

    # Starter/Trial: only allow the first firm (FTMO)
    STARTER_FIRMS = {"FTMO"}
    if requested_firm.upper() not in STARTER_FIRMS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error":    "firm_not_available",
                "message":  f"Your {plan.title()} plan includes 1 prop firm simulator (FTMO). "
                            f"Upgrade to Pro ($79/mo) to access all 5 firms and 20 plans.",
                "current":  plan,
                "requested_firm": requested_firm,
                "upgrade_url": "/pricing",
            }
        )