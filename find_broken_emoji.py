import os

BROKEN = [
    "\xc3\xb0\xc5\xb8",
    "xf0x9f",
    "\u00f0\u0178",
    "\u00c3\u00a2\u0080",
    "\u00c3\u00a2\u00e2",
    "\u00c2\u00b7",
    "\u00c3\u00a2\u201e",
    "ð\u0178",
    "â€",
    "Â·",
    "â†",
    "âš",
    "ï¸",
    "ðŸ",
    "\u00c3\u00b0\u0178",
    "Ã°Å¸",
]

EXTENSIONS = {".tsx", ".ts", ".jsx", ".js"}
SKIP_DIRS  = {"node_modules", ".git", "build", "dist", ".next", "coverage"}

def scan(filepath):
    found = []
    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            for lineno, line in enumerate(f, 1):
                for b in BROKEN:
                    if b in line:
                        found.append((lineno, line.rstrip()[:120]))
                        break
    except Exception as e:
        found.append((0, str(e)))
    return found

def main():
    root = os.getcwd()
    total = 0
    broken = []

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fname in filenames:
            if os.path.splitext(fname)[1] not in EXTENSIONS:
                continue
            fp = os.path.join(dirpath, fname)
            rp = os.path.relpath(fp, root)
            total += 1
            issues = scan(fp)
            if issues:
                broken.append((rp, issues))

    print("")
    print("=" * 70)
    print("BROKEN EMOJI SCAN RESULTS")
    print("=" * 70)
    print("Files scanned : " + str(total))
    print("Files broken  : " + str(len(broken)))
    print("")

    for rp, issues in broken:
        print("BROKEN: " + rp)
        for lineno, preview in issues[:5]:
            print("  line " + str(lineno) + ": " + preview)
        if len(issues) > 5:
            print("  ... and " + str(len(issues) - 5) + " more lines")
        print("")

    if not broken:
        print("All files are clean!")
    else:
        print("FILES TO FIX (" + str(len(broken)) + " total):")
        for rp, issues in broken:
            print("  " + rp)

    print("")

if __name__ == "__main__":
    main()