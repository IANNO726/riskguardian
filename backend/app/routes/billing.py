"""
billing.py — Stripe payment integration for RiskGuardian
Place in: backend/app/routes/billing.py

Then in main.py add these two lines with your other routers:
    from routes.billing import router as billing_router
    app.include_router(billing_router, prefix="/api/v1/billing", tags=["billing"])
"""

import os
import json
import stripe
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

# ── imports matching YOUR project structure ──────────────
from app.database.database import get_db
from app.models.user import User, Subscription
from app.routes.auth_multi import get_current_user   # reuse your existing auth

# ── Stripe config ─────────────────────────────────────────
stripe.api_key     = os.getenv("STRIPE_SECRET_KEY")
WEBHOOK_SECRET     = os.getenv("STRIPE_WEBHOOK_SECRET")
FRONTEND_URL       = os.getenv("FRONTEND_URL", "http://localhost:3000")
ENVIRONMENT        = os.getenv("ENVIRONMENT", "development")

PLAN_PRICE_IDS = {
    "starter":    os.getenv("STRIPE_STARTER_PRICE_ID",    "price_1T65ru6JfXB9ffkPoNcx8gEI"),
    "pro":        os.getenv("STRIPE_PRO_PRICE_ID",        "price_1T65rv6JfXB9ffkPxiCNxwRb"),
    "enterprise": os.getenv("STRIPE_ENTERPRISE_PRICE_ID", "price_1T65rw6JfXB9ffkPJkN5jn0m"),
}

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────
class CreateCheckoutRequest(BaseModel):
    plan:        str
    price_id:    Optional[str] = None
    success_url: Optional[str] = None
    cancel_url:  Optional[str] = None

class CreatePortalRequest(BaseModel):
    return_url: Optional[str] = None


# ══════════════════════════════════════════════════════════
#  POST /api/v1/billing/create-checkout-session
# ══════════════════════════════════════════════════════════
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

    try:
        # Create Stripe customer if not exists
        customer_id = current_user.stripe_customer_id
        if not customer_id:
            customer = stripe.Customer.create(
                email=current_user.email,
                name=current_user.full_name or current_user.username,
                metadata={"user_id": str(current_user.id), "username": current_user.username},
            )
            customer_id = customer.id
            current_user.stripe_customer_id = customer_id
            db.commit()

        # Create Stripe Checkout Session
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

        return {"checkout_url": session.url, "session_id": session.id}

    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Checkout failed: {str(e)}")


# ══════════════════════════════════════════════════════════
#  POST /api/v1/billing/create-portal-session
#  Lets users manage/cancel their subscription
# ══════════════════════════════════════════════════════════
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


# ══════════════════════════════════════════════════════════
#  POST /api/v1/billing/webhook
#  Stripe calls this after payment — updates plan in DB
# ══════════════════════════════════════════════════════════
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
        # ✅ FIX: In development mode, allow unsigned webhooks (e.g. from Stripe Workbench)
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

                # Write to Subscription table
                existing = db.query(Subscription).filter(Subscription.user_id == int(user_id)).first()
                if existing:
                    existing.plan                   = plan
                    existing.status                 = "active"
                    existing.stripe_subscription_id = sub_id
                    existing.updated_at             = datetime.utcnow()
                else:
                    db.add(Subscription(
                        user_id                = int(user_id),
                        stripe_subscription_id = sub_id,
                        stripe_customer_id     = user.stripe_customer_id or "",
                        plan                   = plan,
                        status                 = "active",
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
                user.plan                   = "free"
                user.subscription_status    = "canceled"
                user.stripe_subscription_id = None
                db.commit()

    return JSONResponse({"status": "ok"})


# ══════════════════════════════════════════════════════════
#  GET /api/v1/billing/status
# ══════════════════════════════════════════════════════════
@router.get("/status")
async def billing_status(current_user: User = Depends(get_current_user)):
    return {
        "plan":                   current_user.plan or "free",
        "subscription_status":    current_user.subscription_status,
        "stripe_customer_id":     current_user.stripe_customer_id,
        "stripe_subscription_id": current_user.stripe_subscription_id,
    }


# ══════════════════════════════════════════════════════════
#  POST /api/v1/billing/dev-set-plan  (DEVELOPMENT ONLY)
#  Manually set your own plan without going through Stripe
# ══════════════════════════════════════════════════════════
@router.post("/dev-set-plan")
async def dev_set_plan(
    plan: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if ENVIRONMENT != "development":
        raise HTTPException(status_code=403, detail="Only available in development mode")

    valid_plans = ["free", "starter", "pro", "enterprise"]
    if plan not in valid_plans:
        raise HTTPException(status_code=400, detail=f"Invalid plan. Choose from: {valid_plans}")

    current_user.plan               = plan
    current_user.subscription_status = "active" if plan != "free" else None
    db.commit()

    return {"message": f"✅ Plan updated to '{plan}'", "plan": plan}



