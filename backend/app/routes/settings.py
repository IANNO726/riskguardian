"""
Settings Routes (Risk + Broker + Auto MT5 Login)
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.risk_rule import RiskRule

from app.services.mt5_wrapper import get_mt5\nmt5 = get_mt5()

router = APIRouter(tags=["Settings"])


# Temporary Broker Storage
broker_settings = {
    "broker":"",
    "account":"",
    "password":"",
    "server":""
}


# =========================
# GET SETTINGS
# =========================

@router.get("/")
def get_settings(db: Session = Depends(get_db)):

    rules = db.query(RiskRule).filter(
        RiskRule.user_id == 1
    ).first()


    if not rules:

        rules = RiskRule(

            user_id=1,
            daily_loss_limit=5,
            max_drawdown=10,
            risk_per_trade=1,
            min_rr_ratio=2

        )

        db.add(rules)
        db.commit()
        db.refresh(rules)


    return {

        # Risk

        "dailyLoss": rules.daily_loss_limit,
        "maxDD": rules.max_drawdown,
        "riskPerTrade": rules.risk_per_trade,
        "minRR": rules.min_rr_ratio,


        # Broker

        "broker": broker_settings["broker"],
        "account": broker_settings["account"],
        "password": broker_settings["password"],
        "server": broker_settings["server"],


        # Alerts

        "telegram": True,
        "email": True,
        "sms": False,


        # AI

        "emotionalAI": True,
        "predictiveAI": True,
        "optimizerAI": True

    }


# =========================
# SAVE SETTINGS + AUTO LOGIN
# =========================

@router.post("/save")
def save_settings(settings: dict, db: Session = Depends(get_db)):


    # ---------- SAVE RISK RULES ----------

    rules = db.query(RiskRule).filter(
        RiskRule.user_id == 1
    ).first()


    if not rules:

        rules = RiskRule(user_id=1)
        db.add(rules)


    rules.daily_loss_limit = float(settings["dailyLoss"])
    rules.max_drawdown = float(settings["maxDD"])
    rules.risk_per_trade = float(settings["riskPerTrade"])
    rules.min_rr_ratio = float(settings["minRR"])


    # ---------- SAVE BROKER ----------

    broker_settings["broker"] = settings["broker"]
    broker_settings["account"] = settings["account"]
    broker_settings["password"] = settings["password"]
    broker_settings["server"] = settings["server"]


    db.commit()


    # ---------- AUTO LOGIN MT5 ----------

    try:

        mt5.shutdown()

        initialized = mt5.initialize()

        if not initialized:

            return {
                "message":"Settings saved but MT5 failed to initialize"
            }


        login_result = mt5.login(

            login=int(settings["account"]),
            password=settings["password"],
            server=settings["server"]

        )


        if login_result:

            return {

                "message":"Settings saved and MT5 connected successfully"

            }

        else:

            return {

                "message":"Settings saved but MT5 login failed"

            }


    except Exception as e:

        return {

            "message":f"Settings saved but MT5 error: {str(e)}"

        }



# =========================
# MANUAL RECONNECT
# =========================

@router.post("/reconnect")
def reconnect_mt5():

    mt5.shutdown()

    connected = mt5.initialize()

    if not connected:

        return {
            "status":"error",
            "message":"MT5 initialization failed"
        }

    return {
        "status":"success",
        "message":"MT5 reconnected successfully"
    }


