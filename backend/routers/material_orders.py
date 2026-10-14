from datetime import datetime, timezone
from typing import Literal
from zoneinfo import ZoneInfo

from core.config import TIMEZONE
from core.database import db
from core.inbox import notify_managers
from core.order_ids import allocate_order_id
from core.security import current_account, require_roles
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

router = APIRouter(
    prefix="/api/material-orders",
    tags=["material orders"],
)


class MaterialOrderItem(BaseModel):
    productId: str = Field(min_length=1, max_length=100)
    qty: int = Field(ge=1, le=999)


class MaterialOrderSubmit(BaseModel):
    items: list[MaterialOrderItem] = Field(min_length=1, max_length=100)
    notes: str = Field(default="", max_length=1000)

    @field_validator("notes")
    @classmethod
    def strip_notes(cls, value: str) -> str:
        return value.strip()


class MaterialOrderStatusUpdate(BaseModel):
    status: Literal["done"]


def _utc_timestamp(local_now: datetime) -> str:
    return (
        local_now.astimezone(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _item_snapshot(product: dict, qty: int) -> dict:
    pack = " ".join(
        str(product[key]).strip()
        for key in ("quantity", "unit", "measure")
        if product.get(key)
    )
    return {
        "productId": product["_id"],
        "code": product["refNo"],
        "description": product["title"],
        "brand": product["producer"],
        "pack": pack,
        "qty": qty,
    }


async def _load_products(product_ids: list[str]) -> dict:
    products_by_id = {}
    for product_id in product_ids:
        if product_id not in products_by_id:
            product = await db["products"].find_one({"_id": product_id})
            if product is None:
                raise HTTPException(
                    status_code=422,
                    detail=f"Product '{product_id}' is no longer available.",
                )
            products_by_id[product_id] = product
    return products_by_id


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("technician", "manager", "owner"))],
)
async def submit_material_order(
    body: MaterialOrderSubmit,
    account: dict = Depends(current_account),
) -> dict:
    products_by_id = await _load_products([item.productId for item in body.items])
    local_now = datetime.now(ZoneInfo(TIMEZONE))
    items = [
        _item_snapshot(products_by_id[item.productId], item.qty)
        for item in body.items
    ]

    order = {
        "_id": await allocate_order_id(db, "nextMaterialOrderNumber", "MO"),
        "requestedById": str(account["_id"]),
        "requestedBy": account["name"],
        "department": account.get("department"),
        "date": local_now.date().isoformat(),
        "time": local_now.strftime("%H:%M"),
        "createdAt": _utc_timestamp(local_now),
        "items": items,
        "totalItems": sum(item["qty"] for item in items),
        "notes": body.notes,
        "status": "pending",
    }
    await db["material_orders"].insert_one(order)
    await notify_managers(
        db,
        kind="material_order_created",
        title=f"New material order {order['_id']}",
        body=(
            f"{account['name']} requested {order['totalItems']} "
            f"{'item' if order['totalItems'] == 1 else 'items'}."
        ),
        target="materialOrder",
        target_id=order["_id"],
        actor=account,
    )
    order["id"] = order.pop("_id")
    return order


@router.put(
    "/{order_id}",
    dependencies=[Depends(require_roles("owner", "manager"))],
)
async def edit_material_order(
    order_id: str,
    body: MaterialOrderSubmit,
    account: dict = Depends(current_account),
) -> dict:
    """Managers correct a request, e.g. add missing products or change quantities."""
    order = await db["material_orders"].find_one({"_id": order_id})
    if order is None:
        raise HTTPException(status_code=404, detail="Material order not found.")

    # Lines already on the order keep their snapshot, so products removed from
    # the catalogue since the request was sent can stay on the order.
    snapshots = {
        item["productId"]: item
        for item in order.get("items", [])
        if item.get("productId")
    }
    products_by_id = await _load_products(
        [item.productId for item in body.items if item.productId not in snapshots]
    )
    items = [
        {**snapshots[item.productId], "qty": item.qty}
        if item.productId in snapshots
        else _item_snapshot(products_by_id[item.productId], item.qty)
        for item in body.items
    ]
    changes = {
        "items": items,
        "totalItems": sum(item["qty"] for item in items),
        "notes": body.notes,
        "editedBy": account["name"],
        "editedAt": _utc_timestamp(datetime.now(ZoneInfo(TIMEZONE))),
    }
    await db["material_orders"].update_one({"_id": order_id}, {"$set": changes})
    order.update(changes)
    order["id"] = order.pop("_id")
    return order


@router.patch(
    "/{order_id}/status",
    dependencies=[Depends(require_roles("owner", "manager"))],
)
async def update_material_order_status(
    order_id: str,
    body: MaterialOrderStatusUpdate,
) -> dict:
    result = await db["material_orders"].update_one(
        {"_id": order_id},
        {"$set": {"status": body.status}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Material order not found.")
    return {"id": order_id, "status": body.status}


@router.delete(
    "/{order_id}",
    dependencies=[Depends(require_roles("owner", "manager"))],
)
async def delete_material_order(order_id: str) -> dict:
    result = await db["material_orders"].delete_one({"_id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Material order not found.")
    return {"id": order_id, "deleted": True}
