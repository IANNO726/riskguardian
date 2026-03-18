import sys
sys.path.insert(0, '.')
from app.database.database import Base, engine
from app.routes.white_label import WhiteLabelBranding
Base.metadata.create_all(bind=engine)
print('Done: white_label_branding table created')



