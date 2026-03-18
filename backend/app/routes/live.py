from fastapi import APIRouter, WebSocket
import asyncio
import random
import json

router = APIRouter()

@router.websocket("/live-trades")
async def live_trades(ws: WebSocket):
    await ws.accept()

    try:
        while True:
            # fake demo trade stream
            data = {
                "symbol": "R_100",
                "price": round(random.uniform(100, 200), 2),
                "profit": round(random.uniform(-10, 10), 2),
                "timestamp": asyncio.get_event_loop().time()
            }

            await ws.send_text(json.dumps(data))
            await asyncio.sleep(1)

    except Exception:
        await ws.close()



