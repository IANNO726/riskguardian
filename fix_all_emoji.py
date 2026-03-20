import os

# Each tuple: (broken_string_as_it_appears_in_file, correct_replacement)
# These are the ACTUAL Unicode characters that appear broken on screen
FIXES = [
    # The broken chars are actual Unicode codepoints U+00F0 U+0178 etc
    # that look like emoji when misread
    ("\u00f0\u0178\u2013\u00a5\u00ef\u00b8\u008f", "\U0001f5a5\ufe0f"),  # ðŸ–¥ï¸ -> 🖥️
    ("\u00f0\u0178\u009b\u00a1\u00ef\u00b8\u008f", "\U0001f6e1\ufe0f"),  # ðŸ›¡ï¸ -> 🛡️
    ("\u00f0\u0178\u201d\u2019", "\U0001f512"),   # ðŸ"' -> 🔒
    ("\u00f0\u0178\u201d\u201d", "\U0001f514"),   # ðŸ"" -> 🔔
    ("\u00f0\u0178\u201d\u00b1", "\U0001f4f1"),   # ðŸ"± -> 📱
    ("\u00f0\u0178\u2039\u2030", "\U0001f4ca"),   # ðŸ"Š -> 📊
    ("\u00f0\u0178\u201d\u2039", "\U0001f4cb"),   # ðŸ"‹ -> 📋
    ("\u00f0\u0178\u2019\u00b0", "\U0001f4b0"),   # ðŸ'° -> 💰
    ("\u00f0\u0178\u2019\u00b8", "\U0001f4b8"),   # ðŸ'¸ -> 💸
    ("\u00f0\u0178\u201d\u2c6", "\U0001f4c8"),    # ðŸ"ˆ -> 📈
    ("\u00f0\u0178\u201d\u2030", "\U0001f4c9"),   # ðŸ"‰ -> 📉
    ("\u00f0\u0178\u009a\u2026", "\U0001f680"),   # ðŸš€ -> 🚀
    ("\u00f0\u0178\u02019\u00b4", "\U0001f680"),  # ðŸš€ variant
    ("\u00f0\u0178\u2039\u201e", "\U0001f4c2"),   # ðŸ"‚ -> 📂
    ("\u00f0\u0178\u00a4\u2013", "\U0001f523"),   # ðŸ"£ -> 🔣
    ("\u00f0\u0178\u00a4\u00a5", "\U0001f525"),   # ðŸ"¥ -> 🔥
    ("\u00f0\u0178\u2026\u00b0", "\U0001f6b0"),   # ðŸš° -> 🚰
    ("\u00f0\u0178\u2020\u2013", "\U0001f513"),   # ðŸ"" -> 🔓  (open lock)
    ("\u00f0\u0178\u2039\u00b2", "\U0001f4b2"),   # ðŸ"² -> 💲
    ("\u00f0\u0178\u00a4\u2022", "\U0001f4a1"),   # ðŸ'¡ -> 💡
    ("\u00f0\u0178\u2019\u00a5", "\U0001f4a5"),   # ðŸ'¥ -> 💥
    ("\u00f0\u0178\u2014\u20ac", "\U0001f3c6"),   # ðŸ† -> 🏆
    ("\u00f0\u0178\u017d\u00af", "\U0001f3af"),   # ðŸŽ¯ -> 🎯
    ("\u00f0\u0178\u017d\u2030", "\U0001f389"),   # ðŸŽ‰ -> 🎉
    ("\u00f0\u0178\u017d\u0081", "\U0001f381"),   # ðŸŽ -> 🎁
    ("\u00f0\u0178\u2019\u2018", "\U0001f4b4"),   # ðŸ'´ -> 💴
    ("\u00f0\u0178\u201d\u00b7", "\U0001f4f7"),   # ðŸ"· -> 📷
    ("\u00f0\u0178\u2014\u00a2", "\U0001f3a2"),   # ðŸŽ¢ -> 🎢
    ("\u00f0\u0178\u02019\u00ab", "\U0001f6ab"),  # ðŸš« -> 🚫
    ("\u00f0\u0178\u009b\u2019", "\U0001f6d1"),   # ðŸ›' -> 🛑
    ("\u00f0\u0178\u00a4\u2013\u00ef\u00b8\u008f", "\U0001f523\ufe0f"),
    ("\u00f0\u0178\u00a4\u2013", "\U0001f510"),   # ðŸ"  -> 🔐
    ("\u00f0\u0178\u00a4\u2022", "\U0001f511"),   # ðŸ"' -> 🔑
    ("\u00f0\u0178\u00a4\u201d", "\U0001f513"),   # ðŸ"" -> 🔓
    ("\u00f0\u0178\u2014\u00a2", "\U0001f3a2"),
    ("\u00f0\u0178\u009e\u201a", "\U0001f7e2"),   # ðŸŸ¢ -> 🟢
    ("\u00f0\u0178\u009e\u00a1", "\U0001f7e1"),   # ðŸŸ¡ -> 🟡
    ("\u00f0\u0178\u009e\u00a0", "\U0001f7e0"),   # ðŸŸ  -> 🟠
    ("\u00f0\u0178\u201d\u00b4", "\U0001f4b4"),   # ðŸ"´ -> 🔴 (red circle)
    ("\u00f0\u0178\u00a4\u2013", "\U0001f513"),
    ("\u00f0\u0178\u00a4\u00bb", "\U0001f50b"),   # ðŸ"» -> 🔋
    ("\u00f0\u0178\u00a4\u00a6", "\U0001f4a6"),   # ðŸ'¦ -> 💦
    ("\u00f0\u0178\u00a4\u00af", "\U0001f4af"),   # ðŸ'¯ -> 💯
    ("\u00f0\u0178\u00a5\u2021", "\U0001f4c3"),   # ðŸ"£ -> 📣
    ("\u00f0\u0178\u00a5\u00b0", "\U0001f4f0"),   # ðŸ"° -> 📰
    ("\u00f0\u0178\u00a4\u00b9", "\U0001f4b9"),   # ðŸ'¹ -> 💹
    ("\u00f0\u0178\u00a4\u00ba", "\U0001f4ba"),   # ðŸ'º -> 💺
    ("\u00f0\u0178\u2022\u00ab", "\U0001f52b"),   # ðŸ"« -> 🔫
    ("\u00f0\u0178\u2019\u00a4", "\U0001f4a4"),   # ðŸ'¤ -> 💤
    ("\u00f0\u0178\u2019\u00a4", "\U0001f464"),   # ðŸ'¤ -> 👤
    ("\u00f0\u0178\u2019\u00a5", "\U0001f465"),   # ðŸ'¥ -> 👥
    ("\u00f0\u0178\u0161\u2014", "\U0001f5d4"),   # ðŸ—" -> 🗔
    ("\u00f0\u0178\u0161\u2019", "\U0001f5d9"),   # ðŸ—™ -> 🗙
    ("\u00f0\u0178\u0161\u201a", "\U0001f5da"),   # ðŸ—š -> 🗚
    ("\u00f0\u0178\u0161\u201e", "\U0001f5de"),   # ðŸ—ž -> 🗞
    ("\u00f0\u0178\u0161\u2022", "\U0001f5a1"),   # ðŸ–¡ -> 🖡
    ("\u00f0\u0178\u2013\u00b9", "\U0001f4f9"),   # ðŸ"¹ -> 📹
    ("\u00f0\u0178\u00a5\u2018", "\U0001f4d8"),   # ðŸ"˜ -> 📘
    ("\u00f0\u0178\u00a5\u2019", "\U0001f4d9"),   # ðŸ"™ -> 📙
    ("\u00f0\u0178\u00a5\u201a", "\U0001f4da"),   # ðŸ"š -> 📚
    ("\u00f0\u0178\u00a5\u201c", "\U0001f4dc"),   # ðŸ"œ -> 📜
    ("\u00f0\u0178\u00a5\u2026", "\U0001f4e6"),   # ðŸ"¦ -> 📦
    ("\u00f0\u0178\u00a5\u00a8", "\U0001f4e8"),   # ðŸ"¨ -> 📨
    ("\u00f0\u0178\u00a5\u00a9", "\U0001f4e9"),   # ðŸ"© -> 📩
    ("\u00f0\u0178\u00a5\u00b1", "\U0001f4f1"),   # ðŸ"± -> 📱
    ("\u00f0\u0178\u00a5\u00b3", "\U0001f4f3"),   # ðŸ"³ -> 📳
    ("\u00f0\u0178\u0161\u0081", "\U0001f5c1"),   # ðŸ—  -> 🗁
    ("\u00f0\u0178\u0161\u201c", "\U0001f5dc"),   # ðŸ—œ -> 🗜
    ("\u00f0\u0178\u00a4\u00bf", "\U0001f4bf"),   # ðŸ'¿ -> 💿
    ("\u00f0\u0178\u00a4\u00be", "\U0001f4be"),   # ðŸ'¾ -> 💾
    ("\u00f0\u0178\u00a4\u00bd", "\U0001f4bd"),   # ðŸ'½ -> 💽
    ("\u00f0\u0178\u00a4\u00bb", "\U0001f4bb"),   # ðŸ'» -> 💻
    ("\u00f0\u0178\u00a4\u00bc", "\U0001f4bc"),   # ðŸ'¼ -> 💼
    ("\u00f0\u0178\u00a4\u00b3", "\U0001f4b3"),   # ðŸ'³ -> 💳
    ("\u00f0\u0178\u00a4\u00b5", "\U0001f4b5"),   # ðŸ'µ -> 💵
    ("\u00f0\u0178\u00a4\u00b6", "\U0001f4b6"),   # ðŸ'¶ -> 💶
    ("\u00f0\u0178\u00a4\u00b7", "\U0001f4b7"),   # ðŸ'· -> 💷
    ("\u00f0\u0178\u00a4\u00b8", "\U0001f4b8"),   # ðŸ'¸ -> 💸
    ("\u00f0\u0178\u00a4\u00b1", "\U0001f4b1"),   # ðŸ'± -> 💱
    ("\u00f0\u0178\u00a4\u00b0", "\U0001f4b0"),   # ðŸ'° -> 💰
    ("\u00f0\u0178\u00a4\u00ab", "\U0001f4ab"),   # ðŸ'« -> 💫
    ("\u00f0\u0178\u00a4\u00a9", "\U0001f4a9"),   # ðŸ'© -> 💩
    ("\u00f0\u0178\u00a4\u00a8", "\U0001f4a8"),   # ðŸ'¨ -> 💨
    ("\u00f0\u0178\u00a4\u00a7", "\U0001f4a7"),   # ðŸ'§ -> 💧
    ("\u00f0\u0178\u0178\u2013", "\U0001f52d"),   # ðŸ"­ -> 🔭
    ("\u00f0\u0178\u0178\u201a", "\U0001f52a"),   # ðŸ"ª -> 🔪
    ("\u00f0\u0178\u0178\u2019", "\U0001f529"),   # ðŸ"© -> 🔩
    ("\u00f0\u0178\u0178\u2018", "\U0001f528"),   # ðŸ"¨ -> 🔨
    ("\u00f0\u0178\u0178\u2026", "\U0001f526"),   # ðŸ"¦ -> 🔦
    ("\u00f0\u0178\u0178\u201d", "\U0001f527"),   # ðŸ"§ -> 🔧
    ("\u00f0\u0178\u2014\u00b3", "\U0001f3b3"),   # ðŸŽ³ -> 🎳
    ("\u00f0\u0178\u2014\u00b2", "\U0001f3b2"),   # ðŸŽ² -> 🎲
    ("\u00f0\u0178\u2014\u00b5", "\U0001f3b5"),   # ðŸŽµ -> 🎵
    ("\u00f0\u0178\u2014\u00b6", "\U0001f3b6"),   # ðŸŽ¶ -> 🎶
    ("\u00f0\u0178\u0161\u00a3", "\U0001f5a3"),   # ðŸ–£ -> 🖣
    ("\u00f0\u0178\u009e\u00a3", "\U0001f7e3"),   # ðŸŸ£ -> 🟣
    ("\u00f0\u0178\u009e\u00a4", "\U0001f7e4"),   # ðŸŸ¤ -> 🟤
    ("\u00f0\u0178\u009e\u00a5", "\U0001f7e5"),   # ðŸŸ¥ -> 🟥
    ("\u00f0\u0178\u009e\u00a6", "\U0001f7e6"),   # ðŸŸ¦ -> 🟦
    ("\u00f0\u0178\u009e\u00a7", "\U0001f7e7"),   # ðŸŸ§ -> 🟧
    ("\u00f0\u0178\u009e\u00a8", "\U0001f7e8"),   # ðŸŸ¨ -> 🟨
    ("\u00f0\u0178\u009e\u00a9", "\U0001f7e9"),   # ðŸŸ© -> 🟩
    # Punctuation fixes
    ("\u00e2\u20ac\u201d", "\u2014"),    # â€" -> —
    ("\u00e2\u20ac\u2122", "\u2019"),    # â€™ -> '
    ("\u00e2\u20ac\u0153", "\u201c"),    # â€œ -> "
    ("\u00e2\u20ac\u009d", "\u201d"),    # â€ -> "
    ("\u00e2\u20ac\u02dc", "\u2018"),    # â€˜ -> '
    ("\u00e2\u20ac\u00a6", "\u2026"),    # â€¦ -> …
    ("\u00e2\u20ac\u00a2", "\u2022"),    # â€¢ -> •
    ("\u00c2\u00b7", "\u00b7"),          # Â· -> ·
    ("\u00e2\u2020\u2019", "\u2192"),    # â†' -> →
    ("\u00e2\u2020\u201d", "\u2190"),    # â†" -> ←
    ("\u00e2\u2020\u2018", "\u2191"),    # â†' -> ↑
    ("\u00e2\u2020\u201c", "\u2193"),    # â†" -> ↓
    ("\u00e2\u009a\u00a0", "\u26a0"),    # âš  -> ⚠
    ("\u00e2\u009a\u00a1", "\u26a1"),    # âš¡ -> ⚡
    ("\u00e2\u009c\u0085", "\u2705"),    # âœ… -> ✅
    ("\u00e2\u009c\u0095", "\u2715"),    # âœ• -> ✕
    ("\u00e2\u009c\u0093", "\u2713"),    # âœ" -> ✓
    ("\u00e2\u009c\u008f", "\u270f"),    # âœ -> ✏
    ("\u00e2\u009c\u00a8", "\u2728"),    # âœ¨ -> ✨
    ("\u00e2\u009d\u008c", "\u274c"),    # âŒ -> ❌
    ("\u00e2\u009d\u00a4", "\u2764"),    # â¤ -> ❤
    ("\u00e2\u25ba\u00be", "\u25be"),    # â–¾ -> ▾
    ("\u00c3\u2014", "\u00d7"),          # Ã— -> ×
    ("\u00e2\u20ac\u00b9", "\u2039"),    # â€¹ -> ‹
    ("\u00e2\u20ac\u00ba", "\u203a"),    # â€º -> ›
    ("\u00c2\u00bb", "\u00bb"),          # Â» -> »
    ("\u00c2\u00ab", "\u00ab"),          # Â« -> «
    ("\u00e2\u2014\u00a2", "\u2122"),    # â„¢ -> ™
    ("\u00c2\u00ae", "\u00ae"),          # Â® -> ®
    ("\u00c2\u00a9", "\u00a9"),          # Â© -> ©
    ("\u00c3\u00b7", "\u00f7"),          # Ã· -> ÷
    ("\u00c2\u00b0", "\u00b0"),          # Â° -> °
    ("\u00c2\u00b1", "\u00b1"),          # Â± -> ±
    ("\u00e2\u2030\u00a5", "\u2265"),    # â‰¥ -> ≥
    ("\u00e2\u2030\u00a4", "\u2264"),    # â‰¤ -> ≤
    ("\u00e2\u2030\u00a0", "\u2260"),    # â‰  -> ≠
    ("\u00e2\u2030\u02c6", "\u2248"),    # â‰ˆ -> ≈
    ("\u00e2\u20ac\u00a2", "\u2022"),    # â€¢ -> •
    ("\u00e2\u20ac\u02c6", "\u02c6"),    # â€ˆ
    ("\u00e2\u20ac\u02dc", "\u02dc"),    # â€˜ tilde
    ("\u00e2\u0153\u20ac", "\u0152"),    # Å' -> Œ
]

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
    "frontend/src/components/OnboardingChecklist.tsx",
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
total_fixed = 0
files_fixed = 0

print("")
print("=" * 60)
print("FIXING BROKEN UNICODE IN " + str(len(FILES)) + " FILES")
print("=" * 60)

for rel in FILES:
    fp = os.path.join(root, rel.replace("/", os.sep))
    if not os.path.exists(fp):
        print("NOT FOUND: " + rel)
        continue

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
        files_fixed += 1
        total_fixed += changed
    else:
        print("clean : " + rel)

print("")
print("=" * 60)
print("Files fixed  : " + str(files_fixed))
print("Lines changed: " + str(total_fixed))
print("")
if files_fixed > 0:
    print("Now run:")
    print("  git add .")
    print("  git commit -m \"fix: repair broken unicode emoji in frontend\"")
    print("  git push")
else:
    print("No changes made.")
    print("The broken chars may be a DIFFERENT encoding pattern.")
    print("Upload the broken files here and I will fix them manually.")
print("")