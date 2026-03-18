import sys
sys.path.insert(0, '.')
from app.database.database import Base, engine
from app.routes.team_management import TeamMember, TeamInvite
Base.metadata.create_all(bind=engine)
print('Done: team_members, team_invites tables created')


