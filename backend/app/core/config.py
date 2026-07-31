"""Central config: loads .env once, exposes typed settings.

All env access should go through this module. Do not read os.environ
elsewhere so the app stays portable across Emergent/Replit/Railway.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent.parent  # backend/
load_dotenv(ROOT_DIR / ".env")


class Settings:
    MONGO_URL: str = os.environ["MONGO_URL"]
    DB_NAME: str = os.environ["DB_NAME"]
    JWT_SECRET: str = os.environ["JWT_SECRET"]
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_MINUTES: int = 60
    REFRESH_TOKEN_DAYS: int = 7
    CORS_ORIGINS: list[str] = os.environ.get("CORS_ORIGINS", "*").split(",")

    # Auth / brute force
    LOCKOUT_ATTEMPTS: int = 5
    LOCKOUT_MINUTES: int = 15


settings = Settings()
