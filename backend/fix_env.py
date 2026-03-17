"""
fix_env.py
Adds Gmail SMTP config to your existing .env file.
Run once: python fix_env.py
"""
import os

env_path = r'C:\Users\user\OneDrive\Desktop\Javascript-course\RiskGuardianAgent\backend\.env'

# Read current content
with open(env_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Check if already updated
if 'SMTP_HOST' in content:
    print("✅ SMTP config already exists in .env — nothing to do.")
else:
    # Replace the old EMAIL section with the new one
    old_section = """# ==================== EMAIL ====================
SENDGRID_API_KEY=your_sendgrid_api_key
EMAIL_FROM=noreply@riskguardian.dev
EMAIL_FROM_NAME=Risk Guardian"""

    new_section = """# ==================== EMAIL ====================
# --- Gmail SMTP (testing) ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=ianndirangu41@gmail.com
SMTP_PASSWORD=ndqz opdj beni amif
EMAIL_FROM=ianndirangu41@gmail.com
EMAIL_FROM_NAME=RiskGuardian
# --- Swap these when you get your real domain ---
# SMTP_HOST=smtp-relay.brevo.com
# SMTP_PORT=587
# SMTP_USER=your@brevo_login.com
# SMTP_PASSWORD=your_brevo_smtp_key
# EMAIL_FROM=noreply@riskguardian.com
# EMAIL_FROM_NAME=RiskGuardian
SENDGRID_API_KEY=your_sendgrid_api_key"""

    if old_section in content:
        content = content.replace(old_section, new_section)
        print("✅ Found and replaced EMAIL section.")
    else:
        # Just append if we can't find the exact match
        content += "\n\n# ==================== EMAIL (SMTP) ====================\n"
        content += "SMTP_HOST=smtp.gmail.com\n"
        content += "SMTP_PORT=587\n"
        content += "SMTP_USER=ianndirangu41@gmail.com\n"
        content += "SMTP_PASSWORD=ndqz opdj beni amif\n"
        content += "EMAIL_FROM=ianndirangu41@gmail.com\n"
        content += "EMAIL_FROM_NAME=RiskGuardian\n"
        print("✅ Appended SMTP config to .env.")

    with open(env_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ .env file updated!")

# Verify
print("\nVerifying...")
with open(env_path, 'r', encoding='utf-8') as f:
    for line in f:
        if any(x in line for x in ['SMTP', 'EMAIL_FROM']):
            if not line.startswith('#'):
                print(f"  ✅ {line.strip()}")
