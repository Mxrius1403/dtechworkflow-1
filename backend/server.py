import logging
from contextlib import asynccontextmanager

from core.collections import AUTH_USERS
from core.config import CORS_ORIGINS, OWNER_EMAIL, OWNER_NAME, OWNER_PASSWORD
from core.database import client, db
from core.security import validate_security_config
from email_validator import EmailNotValidError, validate_email
from fastapi import FastAPI
from routers import auth, catalog, data, logistics
from seed.loader import ensure_demo_data
from starlette.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    validate_security_config()
    if len(OWNER_PASSWORD.encode("utf-8")) < 12 or len(OWNER_PASSWORD.encode("utf-8")) > 72:
        raise RuntimeError("OWNER_PASSWORD must be between 12 and 72 UTF-8 bytes.")
    if not OWNER_NAME:
        raise RuntimeError("OWNER_NAME must not be empty.")
    try:
        owner_email = validate_email(OWNER_EMAIL, check_deliverability=False).normalized.lower()
    except EmailNotValidError as error:
        raise RuntimeError("OWNER_EMAIL must be a valid email address.") from error

    await ensure_demo_data()
    await db[AUTH_USERS].create_index("email", unique=True)
    await auth.provision_owner(owner_email, OWNER_PASSWORD, OWNER_NAME)
    yield
    client.close()


app = FastAPI(title="Dentaltech Daily Flow API", lifespan=lifespan)

for module in (auth, data, catalog, logistics):
    app.include_router(module.router)


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "mode": "authenticated, read-only demo data"}


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)
