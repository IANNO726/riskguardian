import os

FILES = [
    "frontend/src/App.tsx",
    "frontend/src/components/AccountSwitcher.tsx",
    "frontend/src/components/AddAccount.tsx",
    "frontend/src/components/AddAccountModal.tsx",
    "frontend/src/components/EquityCurve.tsx",
    "frontend/src/components/FeatureGate.tsx",
    "frontend/src/components/HistoryView.tsx",
    "frontend/src/components/KillSwitch.tsx",
    "frontend/src/components/MobileDashboard.tsx",
    "frontend/src/components/MobileHistory.tsx",
    "frontend/src/components/MobileJournal.tsx",
    "frontend/src/components/MobileNav.tsx",
    "frontend/src/components/MobileTerminal.tsx",
    "frontend/src/components/PortfolioTracker.tsx",
    "frontend/src/components/PositionCard.tsx",
    "frontend/src/components/PropFirmWidget.tsx",
    "frontend/src/components/RiskAlarm.tsx",
    "frontend/src/components/SupportWidget.tsx",
    "frontend/src/components/TerminalView.tsx",
    "frontend/src/components/TradeBlockBanner.tsx",
    "frontend/src/components/TradeTape.tsx",
    "frontend/src/components/TradingTerminal.tsx",
    "frontend/src/config/api.tsx",
    "frontend/src/hooks/useBranding.tsx",
    "frontend/src/hooks/useLiveTrades.tsx",
    "frontend/src/hooks/usePlan.tsx",
    "frontend/src/layout/AppShell.tsx",
    "frontend/src/pages/AdminDashboard.tsx",
    "frontend/src/pages/AdminRisk.tsx",
    "frontend/src/pages/Analytics.tsx",
    "frontend/src/pages/EnterprisePage.tsx",
    "frontend/src/pages/FounderDashboard.tsx",
    "frontend/src/pages/JournalView.tsx",
    "frontend/src/pages/MultiAccountDashboard.tsx",
    "frontend/src/pages/RiskCheck.tsx",
    "frontend/src/pages/Settings.tsx",
    "frontend/src/pages/Simulator.tsx",
    "frontend/src/pages/Terminal.tsx",
]

root = os.getcwd()
fixed = 0
skipped = 0

print("")
print("=" * 60)
print("FIXING ENCODING IN " + str(len(FILES)) + " FILES")
print("=" * 60)

for rel in FILES:
    fp = os.path.join(root, rel.replace("/", os.sep))

    if not os.path.exists(fp):
        print("NOT FOUND: " + rel)
        skipped += 1
        continue

    try:
        # Read raw bytes
        with open(fp, "rb") as f:
            raw = f.read()

        # Try to reverse mojibake: bytes were UTF-8 but read as latin-1
        try:
            text = raw.decode("latin-1").encode("latin-1").decode("utf-8")
            # Only write if it actually changed and is valid
            if text != raw.decode("utf-8", errors="replace"):
                with open(fp, "w", encoding="utf-8") as f:
                    f.write(text)
                print("FIXED  : " + rel)
                fixed += 1
            else:
                print("clean  : " + rel)
        except (UnicodeDecodeError, UnicodeEncodeError):
            # File is already proper UTF-8 or has other encoding
            print("skip   : " + rel + " (already utf-8 or mixed)")
            skipped += 1

    except Exception as e:
        print("ERROR  : " + rel + " -- " + str(e))
        skipped += 1

print("")
print("=" * 60)
print("Fixed  : " + str(fixed))
print("Skipped: " + str(skipped))
print("")
if fixed > 0:
    print("Now run:")
    print("  git add .")
    print("  git commit -m \"fix: repair encoding in all frontend files\"")
    print("  git push")
print("")