from dotenv import load_dotenv
load_dotenv()

import psycopg2
import os
from urllib.parse import urlparse

DATABASE_URL = os.getenv("DATABASE_URL", "")
print(f"DATABASE_URL: {DATABASE_URL[:40]}...")

p = urlparse(DATABASE_URL)
conn = psycopg2.connect(
    dbname=p.path.lstrip("/"),
    user=p.username,
    password=p.password,
    host=p.hostname,
    port=p.port or 5432,
)
cur = conn.cursor()

# List all tables in all schemas
cur.execute("""
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE'
    ORDER BY table_schema, table_name
""")
rows = cur.fetchall()
print("\nAll tables in database:")
for r in rows:
    print(f"  {r[0]}.{r[1]}")

cur.close()
conn.close()