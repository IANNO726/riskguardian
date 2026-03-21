import os, re

FILES = [
    "frontend/src/components/MobileDashboard.tsx",
    "frontend/src/components/MobileHistory.tsx",
    "frontend/src/components/RiskAlarm.tsx",
    "frontend/src/components/TradingTerminal.tsx",
    "frontend/src/pages/AdminRisk.tsx",
    "frontend/src/pages/Terminal.tsx",
]

BROKEN_MARKERS = ["\u00f0", "\u00e2", "\u00c2", "\u00c3"]

root = os.getcwd()
all_sequences = {}

for rel in FILES:
    fp = os.path.join(root, rel.replace("/", os.sep))
    if not os.path.exists(fp):
        continue
    with open(fp, "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()
    for lineno, line in enumerate(lines, 1):
        for marker in BROKEN_MARKERS:
            if marker not in line:
                continue
            # Extract sequences of suspicious chars
            i = 0
            while i < len(line):
                c = line[i]
                if ord(c) in range(0x00c0, 0x0200) or ord(c) == 0x00f0:
                    # Collect the sequence
                    seq = ""
                    j = i
                    while j < len(line) and (ord(line[j]) < 0x0400 and ord(line[j]) > 0x007f):
                        seq += line[j]
                        j += 1
                    if len(seq) >= 2:
                        key = seq
                        if key not in all_sequences:
                            all_sequences[key] = []
                        all_sequences[key].append(rel + ":" + str(lineno))
                    i = j
                else:
                    i += 1

print("UNIQUE BROKEN SEQUENCES FOUND:")
print("=" * 60)
for seq, locations in sorted(all_sequences.items(), key=lambda x: -len(x[1])):
    cps = " ".join(hex(ord(c)) for c in seq)
    print("Sequence: " + repr(seq))
    print("Codepoints: " + cps)
    print("Locations: " + ", ".join(locations[:3]))
    print()