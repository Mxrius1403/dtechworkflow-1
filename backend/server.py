import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from core.config import CORS_ORIGINS
from core.database import client
from routers import catalog, data, logistics
from seed.loader import ensure_demo_data

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    await ensure_demo_data()
    yield
    client.close()


app = FastAPI(title="Dentaltech Daily Flow API", lifespan=lifespan)

for module in (data, catalog, logistics):
    app.include_router(module.router)


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "mode": "read-only demo"}


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)
