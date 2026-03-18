from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database.database import SessionLocal
import asyncio

router = APIRouter()

connections = []


@router.websocket("/ws/admin/live-trades")
async def live_trades_stream(websocket: WebSocket):

    await websocket.accept()
    connections.append(websocket)

    try:

        while True:

            db: Session = SessionLocal()

            trades = db.execute(text("""
                SELECT symbol, volume, profit_loss
                FROM journal_entries
                ORDER BY id DESC
                LIMIT 10
            """)).fetchall()

            data = [
                {
                    "symbol": t[0],
                    "volume": t[1],
                    "profit": t[2] or 0
                }
                for t in trades
            ]

            await websocket.send_json(data)

            await asyncio.sleep(2)

    except WebSocketDisconnect:

        connections.remove(websocket)



