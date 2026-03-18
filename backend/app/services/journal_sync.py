from datetime import datetime, timedelta
from app.services.mt5_wrapper import get_mt5`r`nmt5 = get_mt5()
from sqlalchemy.orm import Session

from app.models.journal import JournalEntry
from app.database.database import SessionLocal


def sync_mt5_trades():

    db: Session = SessionLocal()

    try:

        utc_to = datetime.now()
        utc_from = utc_to - timedelta(days=30)

        deals = mt5.history_deals_get(utc_from, utc_to)

        if deals is None:
            return

        for deal in deals:

            # Only closing trades
            if deal.entry != 1:
                continue

            existing = db.query(JournalEntry).filter(
                JournalEntry.ticket == deal.ticket
            ).first()

            if existing:
                continue

            trade = JournalEntry(

                ticket=deal.ticket,

                date=datetime.fromtimestamp(deal.time),

                symbol=deal.symbol,

                direction="Buy" if deal.type == 0 else "Sell",

                entry_price=deal.price,
                close_price=deal.price,

                volume=deal.volume,

                result=deal.profit,

                notes="Auto imported from MT5"

            )

            db.add(trade)

        db.commit()

    finally:

        db.close()



