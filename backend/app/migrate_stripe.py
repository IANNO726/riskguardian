from sqlalchemy import text
from app.database.database import engine

with engine.connect() as conn:
    conn.execute(text("UPDATE users SET plan = 'pro', subscription_status = 'active' WHERE username = 'Iann'"))
    conn.commit()
    result = conn.execute(text("SELECT id, username, plan, subscription_status FROM users"))
    for row in result:
        print(f"{row[0]} | {row[1]} | {row[2]} | {row[3]}")
    print("Done!")