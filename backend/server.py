import logging
from contextlib import asynccontextmanager

from core.collections import AUTH_USERS
from core.config import CORS_ORIGINS
from core.database import client, db
from core.security import validate_security_config
from fastapi import FastAPI
from routers import auth, catalog, data, logistics, receiving, reports
from seed.loader import ensure_demo_data
from starlette.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    validate_security_config()
    await ensure_demo_data()
    for collection_name in ("auth_users", "users", "cases", "leave_requests"):
        await db[collection_name].update_many(
            {"department": "denture"},
            {"$set": {"department": "prosthesis"}},
        )
    await db[AUTH_USERS].create_index("email", unique=True)
    yield
    client.close()


app = FastAPI(title="Dentaltech Daily Flow API", lifespan=lifespan)

for module in (auth, data, catalog, logistics, receiving, reports):
    app.include_router(module.router)


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "mode": "authenticated demo data with persistent logistics writes"}


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)
