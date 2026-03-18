import sys
sys.path.insert(0, '.')
from app.database.database import SessionLocal
from app.models.user import User

db = SessionLocal()
user = db.query(User).filter(User.username == 'Iann').first()
if not user:
    user = db.query(User).first()
if user:
    user.plan = 'enterprise'
    db.commit()
    print('Done: ' + user.username + ' is now enterprise')
else:
    print('No user found')
db.close()



