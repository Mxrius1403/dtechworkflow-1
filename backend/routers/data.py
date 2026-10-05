import asyncio

from fastapi import APIRouter, Depends, HTTPException

from core.collections import PUBLIC_COLLECTIONS, SETTINGS
from core.database import db
from core.models import BaseDocument
from seed.loader import ensure_demo_data

router = APIRouter(prefix="/api/data", tags=["data"], dependencies=[Depends(ensure_demo_data)])


async def read_collection(collection: str) -> list[dict]:
    docs = await db[collection].find().to_list(10_000)
    return [BaseDocument.from_mongo(d).to_api() for d in docs]


async def read_settings() -> dict:
    doc = await db[SETTINGS].find_one({"_id": "app"})
    return BaseDocument.from_mongo(doc).to_api() if doc else {}


@router.get("")
async def all_data() -> dict:
    """Everything the app screens need, in one response (read-only demo data)."""
    names = list(PUBLIC_COLLECTIONS.items())
    rows = await asyncio.gather(*(read_collection(collection) for _, collection in names))
    payload = {api_name: items for (api_name, _), items in zip(names, rows)}
    payload["settings"] = await read_settings()
    return payload


@router.get("/{name}")
async def one_collection(name: str):
    if name == "settings":
        return await read_settings()
    if name not in PUBLIC_COLLECTIONS:
        raise HTTPException(status_code=404, detail=f"Unknown collection '{name}'")
    return await read_collection(PUBLIC_COLLECTIONS[name])
