import asyncio
from datetime import datetime, timedelta, timezone

from core.collections import AUTH_USERS, PUBLIC_COLLECTIONS, SETTINGS
from core.database import db
from core.models import BaseDocument
from core.security import current_account
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(
    prefix="/api/data",
    tags=["data"],
    dependencies=[Depends(current_account)],
)
MANAGER_ROLES = ("owner", "manager")
TECHNICIAN_COLLECTIONS = frozenset(
    {
        "users",
        "cases",
        "toothOrders",
        "materialOrders",
        "suppliers",
        "notifications",
    }
)
DRIVER_COLLECTIONS = frozenset(
    {"drivers", "clinics", "routes", "stops", "routePlans"}
)


def allowed_collections(account: dict) -> frozenset[str]:
    role = account.get("role")
    if role in MANAGER_ROLES:
        return frozenset(PUBLIC_COLLECTIONS)
    if role == "technician":
        return TECHNICIAN_COLLECTIONS
    if role == "driver":
        return DRIVER_COLLECTIONS
    raise HTTPException(status_code=403, detail="Insufficient permissions.")


async def read_collection(
    collection: str, include_login_email: bool = False
) -> list[dict]:
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
                **(
                    {"email": account["email"]}
                    if include_login_email and account.get("email")
                    else {}
                ),
            }
            for account in auth_users
            if str(account["_id"]) not in existing_ids
        )
    elif collection == "drivers" and include_login_email:
        auth_users = await db[AUTH_USERS].find({"role": "driver"}).to_list(10_000)
        emails = {
            str(account["_id"]): account["email"]
            for account in auth_users
            if account.get("email")
        }
        for row in rows:
            if row["id"] in emails:
                row["email"] = emails[row["id"]]
    return rows


async def read_settings() -> dict:
    doc = await db[SETTINGS].find_one({"_id": "app"})
    return BaseDocument.from_mongo(doc).to_api() if doc else {}


async def read_suppliers() -> list[dict]:
    docs = await db["suppliers"].find().to_list(10_000)
    return [
        {"id": str(doc["_id"]), "name": doc["name"]}
        for doc in docs
        if doc.get("name")
    ]


def visible_material_orders(rows: list[dict], account: dict) -> list[dict]:
    if account.get("role") != "technician":
        return rows
    account_id = str(account["_id"])
    return [order for order in rows if order.get("requestedById") == account_id]


def driver_payload(payload: dict, account: dict) -> dict:
    account_id = str(account["_id"])
    routes = [r for r in payload["routes"] if r.get("driverId") == account_id]
    route_ids = {r["id"] for r in routes}
    stops = [s for s in payload["stops"] if s.get("routeId") in route_ids]
    clinic_ids = {s["clinicId"] for s in stops if s.get("clinicId")}
    scoped = {
        "drivers": [d for d in payload["drivers"] if d["id"] == account_id],
        "clinics": [c for c in payload["clinics"] if c["id"] in clinic_ids],
        "routes": routes,
        "stops": stops,
        "routePlans": [p for p in payload["routePlans"] if p.get("routeId") in route_ids],
    }
    return {name: scoped.get(name, []) for name in payload}


ROUTE_ARCHIVE_AFTER = timedelta(days=10)


async def archive_stale_routes() -> None:
    now = datetime.now(timezone.utc)
    cutoff = (now - ROUTE_ARCHIVE_AFTER).isoformat()
    await db["routes"].update_many(
        {
            "status": "completed",
            "archived": {"$ne": True},
            "completedAt": {"$lte": cutoff},
        },
        {"$set": {"archived": True, "archivedAt": now.isoformat()}},
    )


@router.get("")
async def all_data(account: dict = Depends(current_account)) -> dict:
    """Everything the authenticated app screens need."""
    allowed = allowed_collections(account)
    await archive_stale_routes()
    names = [
        (api_name, collection)
        for api_name, collection in PUBLIC_COLLECTIONS.items()
        if api_name in allowed
    ]
    can_read_reports = account.get("role") in MANAGER_ROLES
    rows = await asyncio.gather(
        *(
            (
                read_suppliers()
                if api_name == "suppliers"
                else read_collection(
                    collection, include_login_email=can_read_reports
                )
            )
            for api_name, collection in names
        )
    )
    payload = {api_name: items for (api_name, _), items in zip(names, rows)}
    if account.get("role") == "driver":
        payload = driver_payload(payload, account)
    payload["materialOrders"] = visible_material_orders(
        payload.get("materialOrders", []), account
    )
    payload["settings"] = await read_settings()
    return payload


@router.get("/{name}")
async def one_collection(name: str, account: dict = Depends(current_account)):
    if name == "settings":
        return await read_settings()
    if name not in PUBLIC_COLLECTIONS:
        raise HTTPException(status_code=404, detail=f"Unknown collection '{name}'")
    if name not in allowed_collections(account):
        raise HTTPException(status_code=403, detail="Insufficient permissions.")
    if account.get("role") == "driver":
        return (await all_data(account))[name]
    if name == "suppliers":
        return await read_suppliers()
    rows = await read_collection(
        PUBLIC_COLLECTIONS[name],
        include_login_email=account.get("role") in MANAGER_ROLES,
    )
    if name == "materialOrders":
        return visible_material_orders(rows, account)
    return rows
