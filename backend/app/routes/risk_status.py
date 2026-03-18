from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.services.rule_engine import RuleEngine


router = APIRouter(tags=["Risk Engine"])


@router.get("/status")
def risk_status(db: Session = Depends(get_db)):

    engine = RuleEngine(db)


    # Example account data
    # Later comes from MT5

    account_data = {

        "balance": 10000,

        "equity": 9800,

        "daily_loss": 300,

        "peak_balance": 10500

    }


    return engine.risk_status(

        user_id=1,

        account_data=account_data

    )


