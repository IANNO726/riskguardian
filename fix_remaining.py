import os

FILES = [
    "frontend/src/components/EquityCurve.tsx",
    "frontend/src/components/KillSwitch.tsx",
    "frontend/src/components/MobileDashboard.tsx",
    "frontend/src/components/MobileHistory.tsx",
    "frontend/src/components/RiskAlarm.tsx",
    "frontend/src/components/TradingTerminal.tsx",
    "frontend/src/config/api.tsx",
    "frontend/src/pages/AdminRisk.tsx",
    "frontend/src/pages/Terminal.tsx",
]

def fix_file(fp):
    try:
        with open(fp, "rb") as f:
            raw = f.read()
        if raw.startswith(b'\xef\xbb\xbf'):
            raw = raw[3:]
        try:
            decoded = raw.decode("utf-8")
        except UnicodeDecodeError:
            return "skip"
        markers = ["\u00c3\u00b0","\u00e2\u20ac","\u00c2\u00b7","\u00c3\u00a2"]
        if not any(m in decoded for m in markers):
            return "clean"
        result = []
        i = 0
        while i < len(decoded):
            start = i
            while i < len(decoded) and ord(decoded[i]) <= 0xFF:
                i += 1
            chunk = decoded[start:i]
            if chunk:
                try:
                    result.append(chunk.encode("latin-1").decode("utf-8", errors="replace"))
                except:
                    result.append(chunk)
            start = i
            while i < len(decoded) and ord(decoded[i]) > 0xFF:
                i += 1
            if i > start:
                result.append(decoded[start:i])
        fixed = "".join(result)
        if fixed == decoded:
            return "no-change"
        with open(fp, "w", encoding="utf-8") as f:
            f.write(fixed)
        return "fixed"
    except Exception as e:
        return "error: " + str(e)

root = os.getcwd()
fixed = 0
for rel in FILES:
    fp = os.path.join(root, rel.replace("/", os.sep))
    if not os.path.exists(fp):
        print("missing: " + rel); continue
    r = fix_file(fp)
    if r == "fixed": fixed += 1
    print(r.upper() + ": " + rel)

print("\nFixed: " + str(fixed) + " files")
if fixed > 0:
    print("\ngit add .")
    print('git commit -m "fix: final 9 files emoji encoding"')
    print("git push")