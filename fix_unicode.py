import os

# These files have broken chars stored as actual Unicode codepoints
# e.g. the 4 chars ð Ÿ " ' instead of the single emoji 🔒
# Simple string replacement fixes them

# Build the replacement map using chr() to avoid encoding issues in this script
def e(codepoint):
    return chr(codepoint)

FIXES = [
    # ðŸ"' -> 🔒 lock
    (e(0xf0)+e(0x178)+e(0x201d)+e(0x2019), e(0x1f512)),
    # ðŸ"´ -> 🔴 red circle  
    (e(0xf0)+e(0x178)+e(0x201d)+e(0xb4), e(0x1f534)),
    # ðŸŸ¢ -> 🟢 green circle
    (e(0xf0)+e(0x178)+e(0x9e)+e(0xa2), e(0x1f7e2)),
    # ðŸŸ¡ -> 🟡 yellow circle
    (e(0xf0)+e(0x178)+e(0x9e)+e(0xa1), e(0x1f7e1)),
    # ðŸŸ  -> 🟠 orange circle
    (e(0xf0)+e(0x178)+e(0x9e)+e(0xa0), e(0x1f7e0)),
    # ðŸ"Š -> 📊 bar chart
    (e(0xf0)+e(0x178)+e(0x201d)+e(0x8a), e(0x1f4ca)),
    # ðŸš€ -> 🚀 rocket
    (e(0xf0)+e(0x178)+e(0x161)+e(0x80), e(0x1f680)),
    # ðŸ"¥ -> 🔥 fire
    (e(0xf0)+e(0x178)+e(0x201d)+e(0xa5), e(0x1f525)),
    # ðŸ"Š -> 📊 (alternative encoding)
    (e(0xf0)+e(0x178)+e(0x2039)+e(0x8a), e(0x1f4ca)),
    # âš ï¸ -> ⚠️ warning
    (e(0xe2)+e(0x9a)+e(0xa0)+e(0xef)+e(0xb8)+e(0x8f), e(0x26a0)+e(0xfe0f)),
    # âš  -> ⚠ warning (no variation selector)
    (e(0xe2)+e(0x9a)+e(0xa0), e(0x26a0)),
    # âš¡ -> ⚡ lightning
    (e(0xe2)+e(0x9a)+e(0xa1), e(0x26a1)),
    # â† -> ← arrow left
    (e(0xe2)+e(0x86)+e(0x90), e(0x2190)),
    # â†' -> → arrow right  
    (e(0xe2)+e(0x86)+e(0x92), e(0x2192)),
    # â€¦ -> … ellipsis
    (e(0xe2)+e(0x80)+e(0xa6), e(0x2026)),
    # â€" -> — em dash
    (e(0xe2)+e(0x80)+e(0x94), e(0x2014)),
    # â€" -> – en dash
    (e(0xe2)+e(0x80)+e(0x93), e(0x2013)),
    # âœ… -> ✅ check mark
    (e(0xe2)+e(0x9c)+e(0x85), e(0x2705)),
    # Â· -> · middle dot
    (e(0xc2)+e(0xb7), e(0xb7)),
]

FILES = [
    "frontend/src/components/KillSwitch.tsx",
    "frontend/src/components/MobileDashboard.tsx",
    "frontend/src/components/MobileHistory.tsx",
    "frontend/src/components/RiskAlarm.tsx",
    "frontend/src/components/TradingTerminal.tsx",
    "frontend/src/config/api.tsx",
    "frontend/src/pages/AdminRisk.tsx",
    "frontend/src/pages/Terminal.tsx",
]

root = os.getcwd()
fixed_count = 0

print("")
print("=" * 60)
print("DIRECT UNICODE REPLACEMENT FOR 8 FILES")
print("=" * 60)

for rel in FILES:
    fp = os.path.join(root, rel.replace("/", os.sep))
    if not os.path.exists(fp):
        print("missing: " + rel)
        continue

    try:
        with open(fp, "r", encoding="utf-8", errors="replace") as f:
            original = f.read()

        fixed = original
        for broken, correct in FIXES:
            fixed = fixed.replace(broken, correct)

        if fixed != original:
            with open(fp, "w", encoding="utf-8") as f:
                f.write(fixed)
            changed = sum(1 for a, b in zip(
                original.splitlines(), fixed.splitlines()) if a != b)
            print("FIXED (" + str(changed) + " lines): " + rel)
            fixed_count += 1
        else:
            print("no-chg : " + rel)

    except Exception as ex:
        print("ERROR  : " + rel + " -- " + str(ex))

print("")
print("=" * 60)
print("Fixed: " + str(fixed_count) + " files")
if fixed_count > 0:
    print("")
    print("Run:")
    print("  git add .")
    print('  git commit -m "fix: final emoji encoding cleanup"')
    print("  git push")
print("")