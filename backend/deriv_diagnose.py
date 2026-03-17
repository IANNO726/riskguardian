"""
Run this on your server: python deriv_diagnose.py
It will print EXACTLY what every Deriv API endpoint returns for your token.
"""
import asyncio, json, websockets, os

TOKEN  = os.getenv("DERIV_TOKEN", "3VRyRQtKUCJYU7d")
APP_ID = os.getenv("DERIV_APP_ID", "1089")
URL    = f"wss://ws.derivws.com/websockets/v3?app_id={APP_ID}"

async def req(ws, payload):
    msg_type = next(k for k in payload if not k.startswith("_"))
    await ws.send(json.dumps(payload))
    while True:
        raw  = await asyncio.wait_for(ws.recv(), timeout=15)
        data = json.loads(raw)
        if data.get("msg_type") == msg_type or "error" in data:
            return data

async def main():
    print(f"\n{'='*60}")
    print(f"Connecting to Deriv WS with token: {TOKEN[:8]}...")
    print(f"{'='*60}\n")

    async with websockets.connect(URL, ping_interval=20) as ws:

        # ── 1. Authorize ──────────────────────────────────────────
        r = await req(ws, {"authorize": TOKEN})
        if "error" in r:
            print(f"❌ AUTHORIZE FAILED: {r['error']}")
            return
        auth = r["authorize"]
        print(f"✅ AUTHORIZED")
        print(f"   loginid  : {auth.get('loginid')}")
        print(f"   fullname : {auth.get('fullname')}")
        print(f"   balance  : {auth.get('balance')} {auth.get('currency')}")
        print(f"   email    : {auth.get('email')}")
        print()

        # ── 2. trading_platform_accounts ─────────────────────────
        r = await req(ws, {"trading_platform_accounts": 1, "platform": "mt5"})
        if "error" in r:
            print(f"❌ trading_platform_accounts ERROR: {r['error']}")
        else:
            accounts = r.get("trading_platform_accounts", [])
            print(f"✅ trading_platform_accounts → {len(accounts)} accounts")
            for acc in accounts:
                print(f"   login={acc.get('login')} balance={acc.get('balance')} "
                      f"equity={acc.get('equity')} margin={acc.get('margin')} "
                      f"env={acc.get('server_info',{}).get('environment')}")
                print(f"   FULL KEYS: {list(acc.keys())}")
            print()

        # ── 3. mt5_get_settings for each account ─────────────────
        for acc in accounts:
            login = acc.get("login")
            r = await req(ws, {"mt5_get_settings": 1, "login": login})
            if "error" in r:
                print(f"❌ mt5_get_settings({login}) ERROR: {r['error']}")
            else:
                s = r.get("mt5_get_settings", {})
                print(f"✅ mt5_get_settings({login})")
                print(f"   balance={s.get('balance')} equity={s.get('equity')} "
                      f"margin={s.get('margin')} credit={s.get('credit')}")
                print(f"   FULL KEYS: {list(s.keys())}")
            print()

        # ── 4. trading_platform_positions (numeric login) ─────────
        for acc in accounts:
            login     = acc.get("login", "")
            num_login = "".join(c for c in login if c.isdigit())
            for login_val in [login, num_login]:
                r = await req(ws, {
                    "trading_platform_positions": 1,
                    "platform": "mt5",
                    "login": login_val,
                })
                if "error" in r:
                    print(f"❌ trading_platform_positions({login_val}) ERROR: {r['error']['code']}: {r['error']['message']}")
                else:
                    pos = r.get("trading_platform_positions", [])
                    print(f"✅ trading_platform_positions({login_val}) → {len(pos)} positions")
                    for p in pos:
                        print(f"   {p}")
                print()

        # ── 5. portfolio ──────────────────────────────────────────
        r = await req(ws, {"portfolio": 1})
        if "error" in r:
            print(f"❌ portfolio ERROR: {r['error']}")
        else:
            contracts = r.get("portfolio", {}).get("contracts", [])
            print(f"✅ portfolio → {len(contracts)} contracts")
            for c in contracts:
                print(f"   {c}")
        print()

        # ── 6. balance subscribe (check if equity field appears) ──
        print("Subscribing to balance stream for 5 seconds...")
        await ws.send(json.dumps({"balance": 1, "subscribe": 1}))
        import time
        deadline = time.time() + 5
        msgs = []
        while time.time() < deadline:
            try:
                raw  = await asyncio.wait_for(ws.recv(), timeout=2)
                data = json.loads(raw)
                if data.get("msg_type") == "balance":
                    msgs.append(data.get("balance", {}))
            except asyncio.TimeoutError:
                break
        print(f"✅ balance stream → {len(msgs)} messages")
        for m in msgs:
            print(f"   {m}")
        print()

        # ── 7. statement (recent) ─────────────────────────────────
        r = await req(ws, {"statement": 1, "limit": 5})
        if "error" in r:
            print(f"❌ statement ERROR: {r['error']}")
        else:
            txns = r.get("statement", {}).get("transactions", [])
            print(f"✅ statement → {len(txns)} recent transactions")
            for t in txns[:3]:
                print(f"   {t}")
        print()

        print("="*60)
        print("DIAGNOSIS COMPLETE")
        print("="*60)

asyncio.run(main())