import os

env_path = r'C:\Users\user\OneDrive\Desktop\Javascript-course\RiskGuardianAgent\backend\.env'

print(f"File exists: {os.path.exists(env_path)}")
print(f"File size: {os.path.getsize(env_path)} bytes")
print()
print("SMTP/EMAIL lines found:")
with open(env_path, encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if any(x in line for x in ['SMTP', 'EMAIL', 'smtp', 'email']):
            print(f"  Line {i}: {repr(line.strip())}")
