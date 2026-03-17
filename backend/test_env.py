from dotenv import load_dotenv
import os

# Load from parent directory
load_dotenv('../.env')

db_url = os.getenv('DATABASE_URL')
print(f"DATABASE_URL: {db_url}")
