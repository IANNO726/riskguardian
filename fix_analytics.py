import os, sys

FILES = [
    "frontend/src/pages/Analytics.tsx",
    "frontend/src/pages/RiskCheck.tsx",
    "frontend/src/pages/Simulator.tsx",
    "frontend/src/pages/JournalView.tsx",
    "frontend/src/pages/EnterprisePage.tsx",
    "frontend/src/pages/AdminDashboard.tsx",
    "frontend/src/pages/MultiAccountDashboard.tsx",
    "frontend/src/pages/Terminal.tsx",
    "frontend/src/pages/AdminRisk.tsx",
    "frontend/src/pages/FounderDashboard.tsx",
    "frontend/src/components/MobileDashboard.tsx",
    "frontend/src/components/MobileJournal.tsx",
    "frontend/src/components/MobileTerminal.tsx",
    "frontend/src/components/MobileHistory.tsx",
    "frontend/src/components/AddAccount.tsx",
    "frontend/src/components/HistoryView.tsx",
    "frontend/src/components/FeatureGate.tsx",
    "frontend/src/components/SupportWidget.tsx",
    "frontend/src/components/PositionCard.tsx",
    "frontend/src/components/TerminalView.tsx",
    "frontend/src/components/TradingTerminal.tsx",
    "frontend/src/components/KillSwitch.tsx",
    "frontend/src/components/RiskAlarm.tsx",
    "frontend/src/components/TradeBlockBanner.tsx",
    "frontend/src/components/TradeTape.tsx",
    "frontend/src/components/PortfolioTracker.tsx",
    "frontend/src/components/AccountSwitcher.tsx",
    "frontend/src/hooks/useLiveTrades.tsx",
    "frontend/src/hooks/usePlan.tsx",
    "frontend/src/hooks/useBranding.tsx",
    "frontend/src/layout/AppShell.tsx",
    "frontend/src/config/api.tsx",
    "frontend/src/App.tsx",
]

def fix_file(fp):
    try:
        with open(fp, "rb") as f:
            raw = f.read()

        # Strip UTF-8 BOM if present
        bom = b'\xef\xbb\xbf'
        had_bom = raw.startswith(bom)
        if had_bom:
            raw = raw[3:]

        # Decode as UTF-8
        try:
            decoded = raw.decode("utf-8")
        except UnicodeDecodeError:
            return "skip-not-utf8"

        # Quick check for mojibake markers
        mojibake_markers = [
            "\u00c3\u00b0",  # ð (start of broken emoji)
            "\u00e2\u20ac",  # â€
            "\u00c2\u00b7",  # Â·
            "\u00c3\u00a2",  # â
        ]
        if not any(m in decoded for m in mojibake_markers):
            return "clean"

        # Reverse the mojibake:
        # The file was originally UTF-8 bytes, but each byte was
        # incorrectly stored as its own Unicode codepoint (latin-1 mapping).
        # To reverse: encode back to bytes using latin-1, then decode as UTF-8.

        # We need to handle chars above U+00FF (already correctly decoded emoji)
        # by splitting the string into latin-1-safe and non-latin-1 chunks.

        result = []
        i = 0
        while i < len(decoded):
            # Collect a run of latin-1 compatible chars
            start = i
            while i < len(decoded) and ord(decoded[i]) <= 0xFF:
                i += 1
            chunk = decoded[start:i]

            if chunk:
                # Try to reverse mojibake on this chunk
                try:
                    reversed_chunk = chunk.encode("latin-1").decode("utf-8", errors="replace")
                    result.append(reversed_chunk)
                except Exception:
                    result.append(chunk)

            # Collect a run of non-latin-1 chars (already correct Unicode)
            start = i
            while i < len(decoded) and ord(decoded[i]) > 0xFF:
                i += 1
            if i > start:
                result.append(decoded[start:i])

        fixed = "".join(result)

        if fixed == decoded:
            return "no-change"

        # Write back (no BOM)
        with open(fp, "w", encoding="utf-8") as f:
            f.write(fixed)
        return "fixed"

    except Exception as e:
        return "error: " + str(e)


root = os.getcwd()
fixed_count = 0

print("")
print("=" * 60)
print("FIXING MOJIBAKE IN " + str(len(FILES)) + " FILES")
print("=" * 60)

for rel in FILES:
    fp = os.path.join(root, rel.replace("/", os.sep))
    if not os.path.exists(fp):
        print("missing : " + rel)
        continue

    result = fix_file(fp)
    if result == "fixed":
        fixed_count += 1
        print("FIXED   : " + rel)
    elif result == "clean":
        print("clean   : " + rel)
    elif result == "no-change":
        print("no-chg  : " + rel)
    else:
        print(result + " : " + rel)

print("")
print("=" * 60)
print("Fixed: " + str(fixed_count) + " files")
print("")
if fixed_count > 0:
    print("Run:")
    print("  git add .")
    print('  git commit -m "fix: repair all frontend emoji encoding"')
    print("  git push")
print("")