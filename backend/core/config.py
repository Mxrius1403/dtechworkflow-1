import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
CORS_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
AUTH_SECRET_KEY = os.environ.get("AUTH_SECRET_KEY", "")
AUTH_COOKIE_SECURE = os.environ.get("AUTH_COOKIE_SECURE", "false").lower() == "true"

DATA_DIR = BACKEND_DIR / "data"
TIMEZONE = "Europe/Dublin"
