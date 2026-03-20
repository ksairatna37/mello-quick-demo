"""
LiveKit Token Server for Mello Hindi Voice

Provides tokens for React Native app to connect to LiveKit rooms.
Run on port 3001: python token_server.py
"""

import os
import uuid
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from livekit import api
import uvicorn

# Load from parent directory .env (where LiveKit creds are)
parent_env = Path(__file__).parent.parent / ".env"
load_dotenv(parent_env)
load_dotenv()  # Also load local .env if exists

app = FastAPI(title="Mello LiveKit Token Server")

# CORS for React Native
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LIVEKIT_URL = os.getenv("LIVEKIT_URL", "wss://your-livekit-server.livekit.cloud")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")


class TokenRequest(BaseModel):
    language: str = "hi-IN"
    userId: str = None
    userName: str = "User"


@app.get("/")
async def health():
    return {"status": "ok", "service": "mello-livekit-token-server"}


@app.post("/api/livekit-token")
async def create_token(request: TokenRequest):
    """Generate a LiveKit token for the user to join a room."""

    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        return {
            "success": False,
            "message": "LiveKit credentials not configured. Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET in .env"
        }

    # Generate unique room name for this session
    room_name = f"mello-hindi-{uuid.uuid4().hex[:8]}"
    user_id = request.userId or f"user-{uuid.uuid4().hex[:8]}"

    # Create token with permissions
    token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    token.with_identity(user_id)
    token.with_name(request.userName)
    token.with_grants(api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
        can_publish_data=True,
    ))

    jwt_token = token.to_jwt()

    print(f"[Token] Created token for room: {room_name}, user: {user_id}")

    return {
        "success": True,
        "token": jwt_token,
        "livekitUrl": LIVEKIT_URL,
        "roomName": room_name,
        "language": request.language,
    }


if __name__ == "__main__":
    print("=" * 50)
    print("Mello LiveKit Token Server")
    print("=" * 50)
    print(f"LiveKit URL: {LIVEKIT_URL}")
    print(f"API Key configured: {'Yes' if LIVEKIT_API_KEY else 'No'}")
    print(f"API Secret configured: {'Yes' if LIVEKIT_API_SECRET else 'No'}")
    print("=" * 50)
    print("Starting server on http://localhost:3001")
    print("=" * 50)

    uvicorn.run(app, host="0.0.0.0", port=3001)
