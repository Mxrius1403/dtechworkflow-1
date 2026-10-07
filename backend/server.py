import logging
from contextlib import asynccontextmanager

from core.collections import AUTH_USERS
from core.config import CORS_ORIGINS
from core.database import client, db
from core.security import validate_security_config
from fastapi import FastAPI
from routers import (
    auth,
    catalog,
    data,
    logistics,
    material_orders,
    products,
    receiving,
    reports,
    suppliers,
    tooth_orders,
)
from seed.loader import ensure_demo_data
from starlette.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


async def ensure_auth_email_index() -> None:
    collection = db[AUTH_USERS]
    partial_filter = {"email": {"$type": "string"}}
    indexes = await collection.index_information()
    for name, index in indexes.items():
        if index.get("key") == [("email", 1)] and (
            index.get("unique") is not True
            or index.get("partialFilterExpression") != partial_filter
        ):
            await collection.drop_index(name)
    await collection.create_index(
        "email",
        unique=True,
        partialFilterExpression=partial_filter,
    )


@asynccontextmanager
async def lifespan(_: FastAPI):
    validate_security_config()
    await ensure_demo_data()
    for collection_name in ("auth_users", "users", "cases"):
        await db[collection_name].update_many(
            {"department": "denture"},
            {"$set": {"department": "prosthesis"}},
        )
    for collection_name in ("auth_users", "users"):
        await db[collection_name].update_many(
            {"role": "technician", "department": {"$exists": True}},
            {"$unset": {"department": ""}},
        )
    await ensure_auth_email_index()
    yield
    client.close()


app = FastAPI(title="Dentaltech Daily Flow API", lifespan=lifespan)

for module in (
    auth,
    data,
    catalog,
    logistics,
    material_orders,
    products,
    receiving,
    reports,
    suppliers,
    tooth_orders,
):
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
