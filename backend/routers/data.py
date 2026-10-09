import asyncio

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


def visible_material_orders(rows: list[dict], account: dict) -> list[dict]:
    if account.get("role") != "technician":
        return rows
    account_id = str(account["_id"])
    return [order for order in rows if order.get("requestedById") == account_id]


def driver_payload(payload: dict, account: dict) -> dict:
    account_id = str(account["_id"])
    routes = [r for r in payload["routes"] if r.get("driverId") == account_id]
    route_ids = {r["id"] for r in routes}
    scoped = {
        "drivers": [d for d in payload["drivers"] if d["id"] == account_id],
        "clinics": payload["clinics"],
        "routes": routes,
        "stops": [s for s in payload["stops"] if s.get("routeId") in route_ids],
        "routePlans": [p for p in payload["routePlans"] if p.get("routeId") in route_ids],
    }
    return {name: scoped.get(name, []) for name in payload}


@router.get("")
async def all_data(account: dict = Depends(current_account)) -> dict:
    """Everything the authenticated app screens need."""
    names = list(PUBLIC_COLLECTIONS.items())
    include_login_email = account.get("role") in ("owner", "manager")
    rows = await asyncio.gather(
        *(
            read_collection(collection, include_login_email=include_login_email)
            for _, collection in names
        )
    )
    payload = {api_name: items for (api_name, _), items in zip(names, rows)}
    if account.get("role") == "driver":
        payload = driver_payload(payload, account)
    payload["materialOrders"] = visible_material_orders(
        payload["materialOrders"], account
    )
    payload["settings"] = await read_settings()
    return payload


@router.get("/{name}")
async def one_collection(name: str, account: dict = Depends(current_account)):
    if name == "settings":
        return await read_settings()
    if name not in PUBLIC_COLLECTIONS:
        raise HTTPException(status_code=404, detail=f"Unknown collection '{name}'")
    rows = await read_collection(
        PUBLIC_COLLECTIONS[name],
        include_login_email=account.get("role") in ("owner", "manager"),
    )
    if account.get("role") == "driver":
        return (await all_data(account))[name]
    if name == "materialOrders":
        return visible_material_orders(rows, account)
    return rows
