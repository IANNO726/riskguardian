"""
billing.py — Stripe payment integration for RiskGuardian
Uses httpx to call Stripe API directly — no stripe package needed.
This bypasses the broken stripe venv on Render completely.
"""

import os
import json
import logging
import httpx
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User, Subscription
from app.routes.auth_multi import get_current_user

logger = logging.getLogger(__name__)

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
WEBHOOK_SECRET    = os.getenv("STRIPE_WEBHOOK_SECRET")
FRONTEND_URL      = os.getenv("FRONTEND_URL", "http://localhost:3000")
ENVIRONMENT       = os.getenv("ENVIRONMENT", "development")
STRIPE_BASE       = "https://api.stripe.com/v1"

PLAN_PRICE_IDS = {
    "starter":    os.getenv("STRIPE_STARTER_PRICE_ID",    "price_1TDPhq6JfXB9ffkP38i9ULEn"),
    "pro":        os.getenv("STRIPE_PRO_PRICE_ID",        "price_1TDPde6JfXB9ffkPxRCQBNx5"),
    "growth":     os.getenv("STRIPE_GROWTH_PRICE_ID",     "price_1TDPfG6JfXB9ffkPrcZMjF6K"),
    "enterprise": os.getenv("STRIPE_ENTERPRISE_PRICE_ID", "price_1TDPgk6JfXB9ffkPQURl7vi4"),
}

router = APIRouter()


def stripe_auth():
    return (STRIPE_SECRET_KEY, "")


async def stripe_post(endpoint: str, data: dict) -> dict:
    """Make a POST request to Stripe API using httpx."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{STRIPE_BASE}/{endpoint}",
            data=data,
            auth=stripe_auth(),
            timeout=30,
        )
    result = resp.json()
    if resp.status_code != 200:
        error_msg = result.get("error", {}).get("message", "Stripe request failed")
        raise HTTPException(status_code=400, detail=f"Stripe error: {error_msg}")
    return result


async def stripe_get(endpoint: str) -> dict:
    """Make a GET request to Stripe API using httpx."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{STRIPE_BASE}/{endpoint}",
            auth=stripe_auth(),
            timeout=30,
        )
    return resp.json()


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
        raise HTTPException(status_code=400, detail=f"No Price ID for plan: {plan}")

    success_url = body.success_url or f"{FRONTEND_URL}/#/app?payment=success&plan={plan}"
    cancel_url  = body.cancel_url  or f"{FRONTEND_URL}/#/setup?plan={plan}"

    logger.info(f"🔵 Checkout: plan={plan}, price_id={price_id}, user={current_user.id}")

    try:
        # Create or reuse Stripe customer
        customer_id = current_user.stripe_customer_id
        if not customer_id:
            customer = await stripe_post("customers", {
                "email": current_user.email,
                "name":  getattr(current_user, 'full_name', None) or current_user.username,
                "metadata[user_id]":  str(current_user.id),
                "metadata[username]": current_user.username,
            })
            customer_id = customer["id"]
            try:
                current_user.stripe_customer_id = customer_id
                db.commit()
            except Exception as db_err:
                logger.warning(f"⚠️ Could not save customer_id: {db_err}")
                db.rollback()

        logger.info(f"🔵 Creating session: customer={customer_id}, price={price_id}")

        # Create Stripe Checkout Session
        session = await stripe_post("checkout/sessions", {
            "customer":                         customer_id,
            "payment_method_types[]":           "card",
            "line_items[0][price]":             price_id,
            "line_items[0][quantity]":          "1",
            "mode":                             "subscription",
            "success_url":                      success_url,
            "cancel_url":                       cancel_url,
            "allow_promotion_codes":            "true",
            "metadata[user_id]":                str(current_user.id),
            "metadata[plan]":                   plan,
            "subscription_data[metadata][user_id]": str(current_user.id),
            "subscription_data[metadata][plan]":    plan,
        })

        logger.info(f"✅ Session created: {session['id']}")
        return {"checkout_url": session["url"], "session_id": session["id"]}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Checkout error: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Checkout failed: {str(e)}")


@router.post("/create-portal-session")
async def create_portal_session(
    body: CreatePortalRequest,
    current_user: User = Depends(get_current_user),
):
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer found")
    session = await stripe_post("billing_portal/sessions", {
        "customer":   current_user.stripe_customer_id,
        "return_url": body.return_url or f"{FRONTEND_URL}/#/app",
    })
    return {"portal_url": session["url"]}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    db: Session = Depends(get_db),
):
    payload = await request.body()

    # Verify webhook signature
    if WEBHOOK_SECRET and stripe_signature:
        import hmac, hashlib, time
        try:
            parts = dict(p.split("=", 1) for p in stripe_signature.split(","))
            ts    = parts.get("t", "")
            sig   = parts.get("v1", "")
            signed_payload = f"{ts}.{payload.decode()}"
            expected = hmac.new(
                WEBHOOK_SECRET.encode(), signed_payload.encode(), hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(expected, sig):
                if ENVIRONMENT != "development":
                    raise HTTPException(status_code=400, detail="Invalid webhook signature")
        except HTTPException:
            raise
        except Exception:
            if ENVIRONMENT != "development":
                raise HTTPException(status_code=400, detail="Webhook verification failed")

    try:
        event = json.loads(payload)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook payload")

    event_type = event.get("type", "")
    data       = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        user_id = data.get("metadata", {}).get("user_id")
        plan    = data.get("metadata", {}).get("plan")
        sub_id  = data.get("subscription")
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
                        user_id=int(user_id), stripe_subscription_id=sub_id or "",
                        stripe_customer_id=user.stripe_customer_id or "",
                        plan=plan, status="active",
                    ))
                db.commit()

    elif event_type == "customer.subscription.updated":
        user_id = data.get("metadata", {}).get("user_id")
        status  = data.get("status")
        if user_id:
            user = db.query(User).filter(User.id == int(user_id)).first()
            if user:
                user.subscription_status = status
                if status == "canceled":
                    user.plan = "free"
                db.commit()

    elif event_type == "customer.subscription.deleted":
        user_id = data.get("metadata", {}).get("user_id")
        if user_id:
            user = db.query(User).filter(User.id == int(user_id)).first()
            if user:
                user.plan                   = "free"
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



