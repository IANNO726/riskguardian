import asyncio
from deriv_api import DerivAPI

DERIV_APP_ID = 1089
DERIV_TOKEN = "1ygNnf7HIuRZeD0"

api = None
connected = False


async def connect_deriv():
    global api, connected

    if connected:
        return

    try:
        print("🔄 Connecting to Deriv...")
        api = DerivAPI(app_id=DERIV_APP_ID)
        await api.authorize(DERIV_TOKEN)
        connected = True
        print("✅ Connected to Deriv")

    except Exception as e:
        print("❌ Deriv connect failed:", e)
        api = None
        connected = False


async def stream_account(ws):
    global api

    await connect_deriv()

    if api is None:
        return

    try:
        balance_stream = await api.subscribe({"balance": 1})
        loop = asyncio.get_running_loop()
        alive = True

        def on_next(msg):
            if not alive:
                return

            asyncio.run_coroutine_threadsafe(
                ws.send_json({
                    "type": "balance",
                    "balance": msg["balance"]["balance"],
                    "currency": msg["balance"]["currency"],
                }),
                loop
            )

        def on_error(err):
            print("❌ Stream error:", err)

        balance_stream.subscribe(
            on_next=on_next,
            on_error=on_error
        )

        # keep alive until client disconnects
        while True:
            await ws.receive_text()

    except Exception:
        print("🔌 Client disconnected")






