from fastapi import APIRouter

router = APIRouter()

# simple in-memory counter
online_users = set()

@router.get("/users-online")
def users_online():
    return {
        "online_users": len(online_users)
    }



