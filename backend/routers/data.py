import asyncio

from core.collections import AUTH_USERS, PUBLIC_COLLECTIONS, SETTINGS
from core.database import db
from core.models import BaseDocument
from core.security import current_account
from fastapi import APIRouter, Depends, HTTPException
from seed.loader import ensure_demo_data

router = APIRouter(
    prefix="/api/data",
    tags=["data"],
    dependencies=[Depends(ensure_demo_data), Depends(current_account)],
)


async def read_collection(collection: str) -> list[dict]:
    docs = await db[collection].find().to_list(10_000)
    rows = [BaseDocument.from_mongo(d).to_api() for d in docs]
    if collection == "users":
        for row in rows:
            row["loginEnabled"] = False
            if row.get("role") == "technician":
                row["department"] = None
        auth_users = await db[AUTH_USERS].find({"role": "technician"}).to_list(10_000)
        existing_ids = {row["id"] for row in rows}
        rows.extend(
            {
                "id": str(account["_id"]),
                "uid": f"u-{str(account['_id']).lower()}",
                "name": account["name"],
                "role": "technician",
                "department": None,
                "active": account["active"],
                "owner": False,
                "createdAt": account["createdAt"],
                "loginEnabled": True,
                "deleted": account.get("deleted", False),
            }
            for account in auth_users
            if str(account["_id"]) not in existing_ids
        )
    return rows


async def read_settings() -> dict:
    doc = await db[SETTINGS].find_one({"_id": "app"})
    return BaseDocument.from_mongo(doc).to_api() if doc else {}


@router.get("")
async def all_data() -> dict:
    """Everything the authenticated app screens need."""
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
