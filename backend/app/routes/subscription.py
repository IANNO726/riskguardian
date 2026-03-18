"""
Stripe Subscription Routes
Handles checkout, webhooks, plan management

CHANGE 7 (plan_gating):
  7a — Growth added to PLAN_PRICES (reads STRIPE_GROWTH_PRICE_ID from .env)
  7b — Growth added to PLAN_FEATURES with correct feature flags
  7c — create_stripe_products() now creates 4 plans at updated prices:
         Starter $29 / Pro $79 / Growth $149 / Enterprise $349
  7d — CheckoutRequest docstring updated; 'growth' accepted automatically
         because it is now a key in PLAN_PRICES
"""
import stripe
import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database.database import get_db
from app.models.user import User, Subscription
from app.routes.auth_multi import get_current_user

router = APIRouter(tags=["Subscriptions"])

# ── Stripe config ─────────────────────────────────────────────
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# ── Plan → Stripe Price ID mapping ───────────────────────────
# CHANGE 7a: "growth" key added — reads STRIPE_GROWTH_PRICE_ID from .env
# Create the $149/mo product in your Stripe Dashboard, paste the price ID
# into .env as STRIPE_GROWTH_PRICE_ID=price_xxx before going live.
PLAN_PRICES = {
    "starter":    os.getenv("STRIPE_STARTER_PRICE_ID",    ""),
    "pro":        os.getenv("STRIPE_PRO_PRICE_ID",        ""),
    "growth":     os.getenv("STRIPE_GROWTH_PRICE_ID",     ""),   # CHANGE 7a
    "enterprise": os.getenv("STRIPE_ENTERPRISE_PRICE_ID", ""),
}

# ── Plan features for permission checks ──────────────────────
# CHANGE 7b: "growth" tier added between "pro" and "enterprise".
# Also back-filled missing new-feature keys across all tiers so
# the frontend always gets a complete feature dict regardless of plan.
PLAN_FEATURES = {
    "free": {
        "max_accounts":              0,
        "ai_journal":                False,
        "telegram_alerts":           False,
        "sms_alerts":                False,
        "prop_firm_profiles":        False,
        "performance_analytics":     False,
        "trade_history_days":        0,
        "priority_support":          False,
        "white_label":               False,
        "api_access":                False,
        "team_management":           False,
        "custom_risk_rules":         False,
        "dedicated_manager":         False,
        "sla_guarantee":             False,
        "custom_integrations":       False,
        "portfolio_tracker":         False,
        "news_calendar":             False,
        "weekly_report":             False,
        "multi_session_compare":     False,
        "custom_firm_builder":       False,
        "notion_sync":               False,
        "custom_alert_schedule":     False,
        "psych_scenario_history":    False,
        "journal_entries_per_month": 0,
    },
    "starter": {
        "max_accounts":              1,
        "ai_journal":                False,
        "telegram_alerts":           True,
        "sms_alerts":                False,
        "prop_firm_profiles":        False,   # 1 firm only (FTMO)
        "performance_analytics":     False,
        "trade_history_days":        30,
        "priority_support":          False,
        "white_label":               False,
        "api_access":                False,
        "team_management":           False,
        "custom_risk_rules":         False,
        "dedicated_manager":         False,
        "sla_guarantee":             False,
        "custom_integrations":       False,
        "portfolio_tracker":         False,
        "news_calendar":             False,
        "weekly_report":             False,
        "multi_session_compare":     False,
        "custom_firm_builder":       False,
        "notion_sync":               False,
        "custom_alert_schedule":     False,
        "psych_scenario_history":    False,
        "journal_entries_per_month": 50,
    },
    "pro": {
        "max_accounts":              3,
        "ai_journal":                True,
        "telegram_alerts":           True,
        "sms_alerts":                True,
        "prop_firm_profiles":        True,   # all 5 firms / 20 plans
        "performance_analytics":     True,
        "trade_history_days":        90,
        "priority_support":          True,
        "white_label":               False,
        "api_access":                False,
        "team_management":           False,
        "custom_risk_rules":         False,
        "dedicated_manager":         False,
        "sla_guarantee":             False,
        "custom_integrations":       False,
        "portfolio_tracker":         True,   # Phase 1 new feature
        "news_calendar":             True,   # Phase 3 new feature
        "weekly_report":             True,   # Phase 4 new feature
        "multi_session_compare":     True,   # max 3 sessions
        "custom_firm_builder":       False,
        "notion_sync":               False,
        "custom_alert_schedule":     False,
        "psych_scenario_history":    False,
        "journal_entries_per_month": 500,
    },
    # CHANGE 7b: Growth plan — all Pro features + Growth-exclusive features
    "growth": {
        "max_accounts":              9999,   # unlimited
        "ai_journal":                True,
        "telegram_alerts":           True,
        "sms_alerts":                True,
        "prop_firm_profiles":        True,
        "performance_analytics":     True,
        "trade_history_days":        365,
        "priority_support":          True,
        "white_label":               False,
        "api_access":                False,
        "team_management":           False,
        "custom_risk_rules":         True,
        "dedicated_manager":         True,
        "sla_guarantee":             False,
        "custom_integrations":       False,
        "portfolio_tracker":         True,
        "news_calendar":             True,
        "weekly_report":             True,
        "multi_session_compare":     True,   # max 5 sessions
        "custom_firm_builder":       True,   # Growth-exclusive
        "notion_sync":               True,   # Growth-exclusive
        "custom_alert_schedule":     True,   # Growth-exclusive
        "psych_scenario_history":    True,   # Growth-exclusive
        "journal_entries_per_month": 9999,   # unlimited
    },
    "enterprise": {
        "max_accounts":              9999,   # unlimited
        "ai_journal":                True,
        "telegram_alerts":           True,
        "sms_alerts":                True,
        "prop_firm_profiles":        True,
        "performance_analytics":     True,
        "trade_history_days":        365,
        "priority_support":          True,
        "white_label":               True,   # Enterprise-exclusive
        "api_access":                True,   # Enterprise-exclusive
        "team_management":           True,   # Enterprise-exclusive
        "custom_risk_rules":         True,
        "dedicated_manager":         True,
        "sla_guarantee":             True,   # Enterprise-exclusive
        "custom_integrations":       True,   # Enterprise-exclusive
        "portfolio_tracker":         True,
        "news_calendar":             True,
        "weekly_report":             True,
        "multi_session_compare":     True,   # max 10 sessions
        "custom_firm_builder":       True,
        "notion_sync":               True,
        "custom_alert_schedule":     True,
        "psych_scenario_history":    True,
        "journal_entries_per_month": 9999,   # unlimited
    },
}


# ══════════════════════════════════════════════════════════════
# HELPER — create Stripe products & prices on first run
# ══════════════════════════════════════════════════════════════
def create_stripe_products():
    """
    Run once to create products in Stripe and print the Price IDs.
    Call from main.py on startup if price IDs are not yet in .env.

    CHANGE 7c: Growth plan added at $149/mo.
    Prices updated to match current pricing page:
      Starter $29 · Pro $79 · Growth $149 · Enterprise $349
    """
    plans = [
        {"name": "RiskGuardian Starter",   "amount":  2900, "key": "STRIPE_STARTER_PRICE_ID"},
        {"name": "RiskGuardian Pro",        "amount":  7900, "key": "STRIPE_PRO_PRICE_ID"},
        {"name": "RiskGuardian Growth",     "amount": 14900, "key": "STRIPE_GROWTH_PRICE_ID"},    # CHANGE 7c
        {"name": "RiskGuardian Enterprise", "amount": 34900, "key": "STRIPE_ENTERPRISE_PRICE_ID"},
    ]
    for plan in plans:
        if not os.getenv(plan["key"]):
            product = stripe.Product.create(name=plan["name"])
            price   = stripe.Price.create(
                product=product.id,
                unit_amount=plan["amount"],
                currency="usd",
                recurring={"interval": "month"},
            )
            print(f"✅ Created {plan['name']} — Price ID: {price.id}")
            print(f"   Add to .env: {plan['key']}={price.id}")


# ══════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════
class CheckoutRequest(BaseModel):
    plan: str   # starter | pro | growth | enterprise   ← CHANGE 7d: growth added


# ══════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════

@router.get("/my-plan")
def get_my_plan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return current user's plan and feature flags."""
    plan = current_user.plan or "free"
    return {
        "plan":     plan,
        "features": PLAN_FEATURES.get(plan, PLAN_FEATURES["free"]),
        "expires_at": current_user.plan_expires_at,
        "stripe_subscription_id": current_user.stripe_subscription_id,
    }


@router.post("/create-checkout")
def create_checkout_session(
    body: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe Checkout session and return the URL."""
    plan = body.plan.lower()
    if plan not in PLAN_PRICES:
        raise HTTPException(status_code=400, detail="Invalid plan")

    price_id = PLAN_PRICES[plan]
    if not price_id:
        raise HTTPException(
            status_code=500,
            detail=f"Price ID for '{plan}' not configured. Add STRIPE_{plan.upper()}_PRICE_ID to .env"
        )

    # Create or reuse Stripe customer
    if not current_user.stripe_customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            name=current_user.full_name or current_user.username,
            metadata={"user_id": current_user.id, "username": current_user.username},
        )
        current_user.stripe_customer_id = customer.id
        db.commit()

    session = stripe.checkout.Session.create(
        customer=current_user.stripe_customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=f"{FRONTEND_URL}/app?payment=success&plan={plan}",
        cancel_url=f"{FRONTEND_URL}/app?payment=cancelled",
        metadata={"user_id": str(current_user.id), "plan": plan},
    )

    return {"checkout_url": session.url, "session_id": session.id}


@router.post("/cancel")
def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel the user's active Stripe subscription at period end."""
    if not current_user.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription")

    stripe.Subscription.modify(
        current_user.stripe_subscription_id,
        cancel_at_period_end=True,
    )

    return {"message": "Subscription will cancel at end of billing period"}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Stripe webhook — handles subscription lifecycle events.
    Register this URL in your Stripe dashboard:
    https://dashboard.stripe.com/webhooks
    URL: https://your-domain.com/api/v1/subscriptions/webhook
    Events to enable:
      - checkout.session.completed
      - customer.subscription.updated
      - customer.subscription.deleted
    """
    payload = await request.body()

    if STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(
                payload, stripe_signature, STRIPE_WEBHOOK_SECRET
            )
        except stripe.error.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Invalid webhook signature")
    else:
        # No webhook secret set — accept all (dev only)
        import json
        event = json.loads(payload)

    event_type = event["type"]
    data = event["data"]["object"]

    # ── checkout.session.completed → activate plan ────────────
    if event_type == "checkout.session.completed":
        user_id = int(data["metadata"]["user_id"])
        plan    = data["metadata"]["plan"]
        sub_id  = data.get("subscription")
        cust_id = data.get("customer")

        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.plan                   = plan
            user.stripe_subscription_id = sub_id
            user.stripe_customer_id     = cust_id

            # Fetch subscription period
            if sub_id:
                sub = stripe.Subscription.retrieve(sub_id)
                user.plan_expires_at = datetime.fromtimestamp(sub["current_period_end"])

                # Save to subscription history
                existing = db.query(Subscription).filter(
                    Subscription.stripe_subscription_id == sub_id
                ).first()
                if not existing:
                    db.add(Subscription(
                        user_id=user_id,
                        stripe_subscription_id=sub_id,
                        stripe_customer_id=cust_id,
                        plan=plan,
                        status="active",
                        current_period_start=datetime.fromtimestamp(sub["current_period_start"]),
                        current_period_end=datetime.fromtimestamp(sub["current_period_end"]),
                    ))
            db.commit()
            print(f"✅ User {user.username} upgraded to {plan}")

    # ── customer.subscription.updated ─────────────────────────
    elif event_type == "customer.subscription.updated":
        sub_id = data["id"]
        status = data["status"]

        sub_record = db.query(Subscription).filter(
            Subscription.stripe_subscription_id == sub_id
        ).first()
        if sub_record:
            sub_record.status = status
            sub_record.current_period_end = datetime.fromtimestamp(data["current_period_end"])
            sub_record.updated_at = datetime.utcnow()

            user = db.query(User).filter(User.id == sub_record.user_id).first()
            if user:
                user.plan_expires_at = datetime.fromtimestamp(data["current_period_end"])
                if status in ["canceled", "unpaid", "past_due"]:
                    user.plan = "free"
            db.commit()

    # ── customer.subscription.deleted → downgrade to free ─────
    elif event_type == "customer.subscription.deleted":
        sub_id = data["id"]

        sub_record = db.query(Subscription).filter(
            Subscription.stripe_subscription_id == sub_id
        ).first()
        if sub_record:
            sub_record.status      = "canceled"
            sub_record.canceled_at = datetime.utcnow()

            user = db.query(User).filter(User.id == sub_record.user_id).first()
            if user:
                user.plan                   = "free"
                user.stripe_subscription_id = None
                user.plan_expires_at        = None
            db.commit()
            print(f"⚠️ Subscription {sub_id} canceled — user downgraded to free")

    return {"status": "ok"}


