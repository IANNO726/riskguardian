"""
billing.py — Stripe payment integration for RiskGuardian
Place in: backend/app/routes/billing.py
"""

import os
import json
import types
import logging

# ── Patch ALL broken stripe submodules (stripe 11.x+ Render venv bug) ──────
# When stripe installs without proper post-install hooks, multiple submodules
# (stripe.apps, stripe.billing_portal, stripe.climate, stripe.financial_connections,
#  stripe.identity, stripe.issuing, stripe.radar, stripe.reporting, stripe.sigma,
#  stripe.tax, stripe.terminal, stripe.treasury, stripe.test_helpers)
# are set to None, crashing _object_classes.py on import.
import stripe as _s

def _stub(name, attrs):
    """Create a stub namespace with given attribute names as dummy classes."""
    ns = types.SimpleNamespace()
    for attr in attrs:
        setattr(ns, attr, type(attr, (), {'OBJECT_NAME': f'{name}.{attr.lower()}', 'construct_from': classmethod(lambda cls, v, k: cls())})())
    return ns

if getattr(_s, 'apps', None) is None:
    _s.apps = _stub('apps', ['Secret'])

if getattr(_s, 'billing_portal', None) is None:
    _s.billing_portal = _stub('billing_portal', ['Configuration', 'Session'])

if getattr(_s, 'climate', None) is None:
    _s.climate = _stub('climate', ['Order', 'Product', 'Supplier'])

if getattr(_s, 'financial_connections', None) is None:
    _s.financial_connections = _stub('financial_connections', ['Account', 'Session', 'Transaction'])

if getattr(_s, 'identity', None) is None:
    _s.identity = _stub('identity', ['VerificationReport', 'VerificationSession'])

if getattr(_s, 'issuing', None) is None:
    _s.issuing = _stub('issuing', ['Authorization', 'Card', 'Cardholder', 'Dispute', 'Token', 'Transaction'])

if getattr(_s, 'radar', None) is None:
    _s.radar = _stub('radar', ['EarlyFraudWarning', 'ValueList', 'ValueListItem'])

if getattr(_s, 'reporting', None) is None:
    _s.reporting = _stub('reporting', ['ReportRun', 'ReportType'])

if getattr(_s, 'sigma', None) is None:
    _s.sigma = _stub('sigma', ['ScheduledQueryRun'])

if getattr(_s, 'tax', None) is None:
    _s.tax = _stub('tax', ['Calculation', 'CalculationLineItem', 'Registration', 'Settings', 'Transaction', 'TransactionLineItem'])

if getattr(_s, 'terminal', None) is None:
    _s.terminal = _stub('terminal', ['Configuration', 'ConnectionToken', 'Location', 'Reader'])

if getattr(_s, 'treasury', None) is None:
    _s.treasury = _stub('treasury', ['CreditReversal', 'DebitReversal', 'FinancialAccount', 'FinancialAccountFeatures', 'InboundTransfer', 'OutboundPayment', 'OutboundTransfer', 'ReceivedCredit', 'ReceivedDebit', 'Transaction', 'TransactionEntry'])

if getattr(_s, 'test_helpers', None) is None:
    _s.test_helpers = _stub('test_helpers', ['TestClock'])

import stripe
# ───────────────────────────────────────────────────────────────────────────

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.database.database import get_db
from app.models.user import User, Subscription
from app.routes.auth_multi import get_current_user

stripe.api_key   = os.getenv("STRIPE_SECRET_KEY")
WEBHOOK_SECRET   = os.getenv("STRIPE_WEBHOOK_SECRET")
FRONTEND_URL     = os.getenv("FRONTEND_URL", "http://localhost:3000")
ENVIRONMENT      = os.getenv("ENVIRONMENT", "development")

PLAN_PRICE_IDS = {
    "starter":    os.getenv("STRIPE_STARTER_PRICE_ID",    "price_1TDPhq6JfXB9ffkP38i9ULEn"),
    "pro":        os.getenv("STRIPE_PRO_PRICE_ID",        "price_1TDPde6JfXB9ffkPxRCQBNx5"),
    "growth":     os.getenv("STRIPE_GROWTH_PRICE_ID",     "price_1TDPfG6JfXB9ffkPrcZMjF6K"),
    "enterprise": os.getenv("STRIPE_ENTERPRISE_PRICE_ID", "price_1TDPgk6JfXB9ffkPQURl7vi4"),
}

router = APIRouter()


class CreateCheckoutRequest(BaseModel):
    plan:        str
    price_id:    Optional[str] = None
    success_url: Optional[str] = None
    cancel_url:  Optional[str] = None

class CreatePortalRequest(BaseModel):
    return_url: Optional[str] = None


@router.post("/create-checkout-session")
async def create_checkout_session(
    body: CreateCheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = body.plan.lower()

    if plan == "free":
        return {"checkout_url": None, "message": "Free plan — no payment required"}

    price_id = body.price_id or PLAN_PRICE_IDS.get(plan)
    if not price_id:
        raise HTTPException(status_code=400, detail=f"No Price ID found for plan: {plan}")

    success_url = body.success_url or f"{FRONTEND_URL}/#/app?payment=success&plan={plan}"
    cancel_url  = body.cancel_url  or f"{FRONTEND_URL}/#/setup?plan={plan}"

    logger.info(f"🔵 Checkout: plan={plan}, price_id={price_id}, user={current_user.id}")

    try:
        customer_id = current_user.stripe_customer_id
        if not customer_id:
            customer = stripe.Customer.create(
                email=current_user.email,
                name=getattr(current_user, 'full_name', None) or current_user.username,
                metadata={"user_id": str(current_user.id), "username": current_user.username},
            )
            customer_id = customer.id
            try:
                current_user.stripe_customer_id = customer_id
                db.commit()
            except Exception as db_err:
                logger.warning(f"⚠️ Could not save customer_id: {db_err}")
                db.rollback()

        logger.info(f"🔵 Creating session: customer={customer_id}, price={price_id}")

        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"user_id": str(current_user.id), "plan": plan},
            subscription_data={"metadata": {"user_id": str(current_user.id), "plan": plan}},
            allow_promotion_codes=True,
        )

        logger.info(f"✅ Session created: {session.id}")
        return {"checkout_url": session.url, "session_id": session.id}

    except stripe.error.StripeError as e:
        logger.error(f"❌ Stripe error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Checkout exception: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Checkout failed: {type(e).__name__}: {str(e)}")


@router.post("/create-portal-session")
async def create_portal_session(
    body: CreatePortalRequest,
    current_user: User = Depends(get_current_user),
):
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer found")
    try:
        session = stripe.billing_portal.Session.create(
            customer=current_user.stripe_customer_id,
            return_url=body.return_url or f"{FRONTEND_URL}/#/app",
        )
        return {"portal_url": session.url}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    db: Session = Depends(get_db),
):
    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        if ENVIRONMENT == "development":
            try:
                event = json.loads(payload)
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid webhook payload")
        else:
            raise HTTPException(status_code=400, detail="Invalid webhook signature")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {str(e)}")

    event_type = event["type"]

    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.get("metadata", {}).get("user_id")
        plan    = session.get("metadata", {}).get("plan")
        sub_id  = session.get("subscription")
        if user_id and plan:
            user = db.query(User).filter(User.id == int(user_id)).first()
            if user:
                user.plan                   = plan
                user.subscription_status    = "active"
                user.stripe_subscription_id = sub_id
                existing = db.query(Subscription).filter(Subscription.user_id == int(user_id)).first()
                if existing:
                    existing.plan                   = plan
                    existing.status                 = "active"
                    existing.stripe_subscription_id = sub_id
                    existing.updated_at             = datetime.utcnow()
                else:
                    db.add(Subscription(
                        user_id=int(user_id), stripe_subscription_id=sub_id,
                        stripe_customer_id=user.stripe_customer_id or "",
                        plan=plan, status="active",
                    ))
                db.commit()

    elif event_type == "customer.subscription.updated":
        sub     = event["data"]["object"]
        user_id = sub.get("metadata", {}).get("user_id")
        status  = sub.get("status")
        if user_id:
            user = db.query(User).filter(User.id == int(user_id)).first()
            if user:
                user.subscription_status = status
                if status == "canceled":
                    user.plan = "free"
                db.commit()

    elif event_type == "customer.subscription.deleted":
        sub     = event["data"]["object"]
        user_id = sub.get("metadata", {}).get("user_id")
        if user_id:
            user = db.query(User).filter(User.id == int(user_id)).first()
            if user:
                user.plan = "free"
                user.subscription_status    = "canceled"
                user.stripe_subscription_id = None
                db.commit()

    return JSONResponse({"status": "ok"})


@router.get("/status")
async def billing_status(current_user: User = Depends(get_current_user)):
    return {
        "plan":                   current_user.plan or "free",
        "subscription_status":    current_user.subscription_status,
        "stripe_customer_id":     current_user.stripe_customer_id,
        "stripe_subscription_id": current_user.stripe_subscription_id,
    }


@router.post("/dev-set-plan")
async def dev_set_plan(
    plan: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if ENVIRONMENT != "development":
        raise HTTPException(status_code=403, detail="Only available in development mode")
    valid_plans = ["free", "starter", "pro", "growth", "enterprise"]
    if plan not in valid_plans:
        raise HTTPException(status_code=400, detail=f"Invalid plan. Choose from: {valid_plans}")
    current_user.plan                = plan
    current_user.subscription_status = "active" if plan != "free" else None
    db.commit()
    return {"message": f"✅ Plan updated to '{plan}'", "plan": plan}



