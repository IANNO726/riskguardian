from fastapi import APIRouter
import psutil
import random

router = APIRouter()

# -----------------------------------
# MOCK ONLINE USER STORAGE
# -----------------------------------

online_users = set()


# -----------------------------------
# MONTHLY REVENUE
# -----------------------------------

@router.get("/revenue")
def revenue():

    # Example SaaS subscription revenue
    # Later this will connect to Stripe

    monthly_revenue = 49 * 12

    return {
        "monthly_revenue": monthly_revenue
    }


# -----------------------------------
# SERVER HEALTH
# -----------------------------------

@router.get("/server-health")
def server_health():

    return {
        "cpu": psutil.cpu_percent(),
        "memory": psutil.virtual_memory().percent,
        "disk": psutil.disk_usage('/').percent,
        "status": "running"
    }


# -----------------------------------
# USERS ONLINE
# -----------------------------------

@router.get("/users-online")
def users_online():

    # Demo random user count

    return {
        "online_users": random.randint(5, 30)
    }


# -----------------------------------
# REVENUE ANALYTICS
# -----------------------------------

@router.get("/revenue-analytics")
def revenue_analytics():

    return [

        {"month": "Jan", "revenue": 200},
        {"month": "Feb", "revenue": 350},
        {"month": "Mar", "revenue": 700},
        {"month": "Apr", "revenue": 1200},
        {"month": "May", "revenue": 1800},
        {"month": "Jun", "revenue": 2400}

    ]


# -----------------------------------
# PROP FIRM RISK MONITOR
# -----------------------------------

@router.get("/prop-risk")
def prop_risk():

    return [

        {"user": "Trader_1", "rule": "Daily Loss Limit"},
        {"user": "Trader_2", "rule": "Max Drawdown"},
        {"user": "Trader_3", "rule": "Overleveraging"}

    ]


# -----------------------------------
# GLOBAL TRADER MAP
# -----------------------------------

@router.get("/trader-map")
def trader_map():

    # Coordinates are [longitude, latitude]

    return [

        {
            "country": "USA",
            "coordinates": [-95, 37],
            "users": 5
        },

        {
            "country": "UK",
            "coordinates": [-1, 52],
            "users": 3
        },

        {
            "country": "Kenya",
            "coordinates": [37, -1],
            "users": 2
        },

        {
            "country": "UAE",
            "coordinates": [54, 24],
            "users": 2
        },

        {
            "country": "Singapore",
            "coordinates": [103.8, 1.3],
            "users": 2
        }

    ]


