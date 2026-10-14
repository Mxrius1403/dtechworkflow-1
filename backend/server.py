import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import RequestResponseEndpoint
from starlette.middleware.cors import CORSMiddleware

from core.cases import ensure_case_indexes
from core.changes import area_of_write, record_change
from core.collections import AUTH_USERS
from core.config import CORS_ORIGINS, HOST, PORT
from core.database import client, db
from core.inbox import ensure_inbox_indexes
from core.security import has_allowed_request_origin, validate_security_config
from core.service_types import ensure_service_type_indexes
from routers import (
    auth,
    cases,
    catalog,
    changes,
    data,
    inbox,
    logistics,
    material_orders,
    products,
    receiving,
    reports,
    service_types,
    suppliers,
    tooth_orders,
)

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)


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
    await ensure_inbox_indexes(db)
    await ensure_case_indexes(db)
    await ensure_service_type_indexes(db)
    await data.ensure_driver_data_indexes()
    await receiving.expire_completed_cases()
    expiry_task = asyncio.create_task(
        receiving.completed_case_expiry_loop(),
        name="completed-case-expiry",
    )
    try:
        yield
    finally:
        expiry_task.cancel()
        try:
            await expiry_task
        except asyncio.CancelledError:
            pass
        client.close()


app = FastAPI(title="Dentaltech Daily Flow API", lifespan=lifespan)


@app.middleware("http")
async def protect_state_changing_requests(
    request: Request, call_next: RequestResponseEndpoint
) -> Response:
    if (
        request.url.path.startswith("/api/")
        and request.method not in ("GET", "HEAD", "OPTIONS")
        and not has_allowed_request_origin(request)
    ):
        return JSONResponse(
            {"detail": "Request origin is missing or not allowed."},
            status_code=403,
        )
    return await call_next(request)


@app.middleware("http")
async def record_successful_writes(
    request: Request, call_next: RequestResponseEndpoint
) -> Response:
    response = await call_next(request)
    area = (
        area_of_write(request.url.path)
        if request.method not in ("GET", "HEAD", "OPTIONS")
        else None
    )
    if area and response.status_code < 400:
        await record_change(db, area)
    return response


@app.middleware("http")
async def disable_api_caching(
    request: Request, call_next: RequestResponseEndpoint
) -> Response:
    # Without this, Safari may answer a reload from its own cache and show old
    # lists. It also keeps one person's data out of the cache of a shared device.
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


for module in (
    auth,
    cases,
    changes,
    data,
    catalog,
    inbox,
    logistics,
    material_orders,
    products,
    receiving,
    reports,
    service_types,
    suppliers,
    tooth_orders,
):
    app.include_router(module.router)


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok"}


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT)
