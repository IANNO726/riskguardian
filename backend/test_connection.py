"""
Run this first to diagnose the exact network issue.
python test_connection.py
"""
import subprocess
import sys

print("=" * 50)
print("RiskGuardian — Network Diagnostics")
print("=" * 50)

# Test 1: Can we reach Telegram at all?
print("\n1. Pinging api.telegram.org...")
try:
    result = subprocess.run(
        ["ping", "-n", "3", "api.telegram.org"],
        capture_output=True, text=True, timeout=15
    )
    if "TTL=" in result.stdout or "bytes=" in result.stdout:
        print("   ✅ Ping works — network is reachable")
    else:
        print("   ❌ Ping failed — Telegram may be blocked")
        print(result.stdout[-300:])
except Exception as e:
    print(f"   ❌ Ping error: {e}")

# Test 2: Try with requests instead of httpx
print("\n2. Testing with 'requests' library...")
try:
    import requests
    r = requests.get(
        "https://api.telegram.org",
        timeout=15,
        verify=True
    )
    print(f"   ✅ requests works! Status: {r.status_code}")
except requests.exceptions.SSLError as e:
    print(f"   ❌ SSL Error: {e}")
except requests.exceptions.Timeout:
    print("   ❌ Timeout — Telegram blocked by firewall/ISP/VPN")
except Exception as e:
    print(f"   ❌ Error: {type(e).__name__}: {e}")

# Test 3: Try with urllib (built-in, no SSL verify)
print("\n3. Testing with urllib (no SSL verify)...")
try:
    import urllib.request
    import ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.urlopen(
        "https://api.telegram.org", context=ctx, timeout=15
    )
    print(f"   ✅ urllib works! Status: {req.status}")
except Exception as e:
    print(f"   ❌ urllib also failed: {type(e).__name__}: {e}")

# Test 4: Check if proxy is needed
print("\n4. Checking system proxy settings...")
import os
proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy") or \
        os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy")
if proxy:
    print(f"   Proxy found: {proxy}")
else:
    print("   No proxy configured in environment")

print("\n" + "=" * 50)
print("SOLUTION based on results:")
print("  If all tests fail  → Telegram is blocked by your ISP/firewall")
print("  If SSL fails only  → Run: pip install certifi")
print("  If ping works      → Try with a VPN or mobile hotspot")
print("=" * 50)


