import os
import re

# ── Complete broken → correct mapping ─────────────────────────
REPLACEMENTS = [
    # Emoji
    ("ðŸŽ‰", "🎉"), ("ðŸš€", "🚀"), ("ðŸ''", "👑"), ("ðŸŽ", "🎁"),
    ("ðŸ"'", "🔒"), ("ðŸ""", "🔔"), ("ðŸ"±", "📱"), ("ðŸ–¥ï¸", "🖥️"),
    ("ðŸ›¡ï¸", "🛡️"), ("ðŸ"Š", "📊"), ("ðŸ"‹", "📋"), ("ðŸ'°", "💰"),
    ("ðŸ'¸", "💸"), ("ðŸ"ˆ", "📈"), ("ðŸ"‰", "📉"), ("ðŸ¢", "🏢"),
    ("ðŸŸ¢", "🟢"), ("ðŸŸ¡", "🟡"), ("ðŸŸ ", "🟠"), ("ðŸ"´", "🔴"),
    ("ðŸ¤–", "🤖"), ("ðŸ§˜", "🧘"), ("ðŸ˜¤", "😤"), ("ðŸ§®", "🧮"),
    ("ðŸ'¥", "👥"), ("ðŸ'¤", "👤"), ("ðŸŒ", "🌐"), ("âœï¸", "✏️"),
    ("ðŸ"—", "🔗"), ("ðŸ"–", "📖"), ("ðŸ"", "📝"), ("ðŸ", "📁"),
    ("ðŸš«", "🚫"), ("ðŸ'¡", "💡"), ("ðŸ"¥", "🔥"), ("ðŸ†", "🏆"),
    ("ðŸŽ¯", "🎯"), ("ðŸ"", "🔍"), ("ðŸ'€", "👀"), ("ðŸ"¬", "📬"),
    ("ðŸ"©", "📩"), ("ðŸ"§", "📧"), ("ðŸ›'", "🛑"), ("âš¡", "⚡"),
    ("ðŸ'«", "💫"), ("ðŸŒŸ", "🌟"), ("âœ…", "✅"), ("âŒ", "❌"),
    ("â­", "⭐"), ("ðŸ"…", "📅"), ("ðŸ"†", "📆"), ("ðŸ—"", "🗓"),
    ("ðŸ•", "🕐"), ("ðŸ"€", "🔓"), ("ðŸ"'", "🔑"), ("ðŸ¦", "🏦"),
    ("ðŸŒ±", "🌱"), ("ðŸ"Œ", "📌"), ("ðŸ"–", "📖"), ("ðŸ"", "🔎"),
    ("ðŸŽ–", "🎖"), ("ðŸ…", "🏅"), ("ðŸŽ—", "🎗"), ("ðŸ'Ž", "💎"),
    ("ðŸ—", "🗝"), ("ðŸ"²", "📲"), ("ðŸ'¬", "💬"), ("ðŸ'­", "💭"),
    ("ðŸ—£", "🗣"), ("ðŸ"£", "📣"), ("ðŸ"¢", "📢"), ("ðŸ""", "🔔"),
    ("ðŸ"•", "🔕"), ("ðŸ"‡", "📇"), ("ðŸ"ˆ", "📈"), ("ðŸ"‰", "📉"),
    ("ðŸ"Š", "📊"), ("ðŸ"‹", "📋"), ("ðŸ"Œ", "📌"), ("ðŸ"", "📍"),
    ("ðŸ"Ž", "📎"), ("ðŸ"", "📏"), ("ðŸ"", "📐"), ("ðŸ—‚", "🗂"),
    ("ðŸ—ƒ", "🗃"), ("ðŸ—„", "🗄"), ("ðŸ—'", "🗑"), ("ðŸ"§", "🔧"),
    ("ðŸ"¨", "🔨"), ("ðŸ"©", "🔩"), ("ðŸ"ª", "🔪"), ("ðŸ"«", "🔫"),
    ("ðŸ'£", "💣"), ("ðŸ'Š", "💊"), ("ðŸ'‰", "💉"), ("ðŸ"¬", "🔬"),
    ("ðŸ"­", "🔭"), ("ðŸ"¡", "📡"), ("ðŸš'", "🚑"), ("ðŸš'", "🚒"),
    ("ðŸš"", "🚓"), ("ðŸš•", "🚕"), ("ðŸš—", "🚗"), ("ðŸšŒ", "🚌"),
    ("ðŸš‚", "🚂"), ("âœˆï¸", "✈️"), ("ðŸš€", "🚀"), ("ðŸ›¸", "🛸"),
    ("ðŸŒ", "🌍"), ("ðŸŒ", "🌎"), ("ðŸŒ", "🌏"), ("ðŸŒ™", "🌙"),
    ("â˜€ï¸", "☀️"), ("â›…", "⛅"), ("ðŸŒ§", "🌧"), ("â›ˆ", "⛈"),
    ("ðŸŒ©", "🌩"), ("ðŸŒ¨", "🌨"), ("ðŸŒ¬", "🌬"), ("ðŸŒ€", "🌀"),
    ("ðŸŒˆ", "🌈"), ("â˜‚ï¸", "☂️"), ("â˜ƒï¸", "☃️"), ("â›„", "⛄"),
    ("ðŸ"¥", "🔥"), ("ðŸ'§", "💧"), ("ðŸŒŠ", "🌊"), ("ðŸŒ¿", "🌿"),
    ("ðŸƒ", "🍃"), ("ðŸ‚", "🍂"), ("ðŸ", "🍁"), ("ðŸŒ·", "🌷"),
    ("ðŸŒ¹", "🌹"), ("ðŸŒº", "🌺"), ("ðŸŒ»", "🌻"), ("ðŸŒ¼", "🌼"),
    ("ðŸŒ½", "🌽"), ("ðŸ„", "🍄"), ("ðŸ€", "🍀"), ("ðŸŒ±", "🌱"),
    ("ðŸª¶", "🪶"), ("ðŸª", "🪨"), ("ðŸœ", "🏜"), ("ðŸ"", "📍"),
    ("ðŸªœ", "🪜"), ("ðŸ'", "💹"),
    # Symbols & punctuation
    ("â€"", "—"),   ("â€™", "'"),   ("â€œ", "\u201c"), ("â€", "\u201d"),
    ("â€˜", "\u2018"), ("â€¦", "…"), ("â€¢", "•"),   ("Â·", "·"),
    ("â†'", "→"),  ("â†"", "←"),  ("â†'", "↑"),  ("â†"", "↓"),
    ("â€", "\u200b"), ("â€‹", "\u200b"),
    ("âš ", "⚠"),   ("âš ï¸", "⚠️"), ("âš¡", "⚡"),
    ("â—†", "◆"),   ("â—‡", "◇"),   ("â—¼", "◼"),   ("â—½", "◽"),
    ("â–¶", "▶"),   ("â—€", "◀"),   ("â–²", "▲"),   ("â–¼", "▼"),
    ("â˜…", "★"),   ("â˜†", "☆"),   ("â™¥", "♥"),   ("â™£", "♣"),
    ("â™¦", "♦"),   ("â™¦", "♦"),   ("â™›", "♛"),   ("â™š", "♚"),
    ("Ã—", "×"),    ("Ã·", "÷"),    ("Â°", "°"),    ("Â±", "±"),
    ("â‰¥", "≥"),   ("â‰¤", "≤"),   ("â‰ ", "≠"),   ("â‰ˆ", "≈"),
    # Variation selectors that cause display issues
    ("\xef\xb8\x8f", ""),
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

def fix_file(filepath):
    if not os.path.exists(filepath):
        print("  SKIP (not found): " + filepath)
        return 0

    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        original = f.read()

    fixed = original
    for broken, correct in REPLACEMENTS:
        fixed = fixed.replace(broken, correct)

    if fixed == original:
        return 0

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(fixed)

    changed = sum(1 for a, b in zip(original.splitlines(), fixed.splitlines()) if a != b)
    return changed

def main():
    root = os.getcwd()
    print("")
    print("=" * 60)
    print("AUTO-FIX BROKEN EMOJI ENCODING")
    print("=" * 60)

    total_fixed = 0
    files_fixed = 0

    for rel in FILES:
        # Handle both / and \ separators
        fp = os.path.join(root, rel.replace("/", os.sep))
        changed = fix_file(fp)
        if changed > 0:
            files_fixed += 1
            total_fixed += changed
            print("FIXED  (" + str(changed) + " lines): " + rel)
        else:
            print("clean  : " + rel)

    print("")
    print("=" * 60)
    print("Files fixed  : " + str(files_fixed))
    print("Lines changed: " + str(total_fixed))
    print("")
    if files_fixed > 0:
        print("Done! Now run:")
        print("  git add .")
        print('  git commit -m "fix: repair broken UTF-8 emoji in all frontend files"')
        print("  git push")
    else:
        print("Nothing to fix - all files already clean.")
    print("")

if __name__ == "__main__":
    main()