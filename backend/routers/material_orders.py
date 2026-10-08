from datetime import datetime, timezone
from typing import Literal
from zoneinfo import ZoneInfo

from core.config import TIMEZONE
from core.database import db
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


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("technician", "manager", "owner"))],
)
async def submit_material_order(
    body: MaterialOrderSubmit,
    account: dict = Depends(current_account),
) -> dict:
    products_by_id = {}
    for item in body.items:
        if item.productId not in products_by_id:
            product = await db["products"].find_one({"_id": item.productId})
            if product is None:
                raise HTTPException(
                    status_code=422,
                    detail=f"Product '{item.productId}' is no longer available.",
                )
            products_by_id[item.productId] = product

    local_now = datetime.now(ZoneInfo(TIMEZONE))
    items = []
    for item in body.items:
        product = products_by_id[item.productId]
        pack = " ".join(
            str(product[key]).strip()
            for key in ("quantity", "unit", "measure")
            if product.get(key)
        )
        items.append(
            {
                "productId": item.productId,
                "code": product["refNo"],
                "description": product["title"],
                "brand": product["producer"],
                "pack": pack,
                "qty": item.qty,
            }
        )

    order = {
        "_id": await allocate_order_id(db, "nextMaterialOrderNumber", "MO"),
        "requestedById": str(account["_id"]),
        "requestedBy": account["name"],
        "department": account.get("department"),
        "date": local_now.date().isoformat(),
        "time": local_now.strftime("%H:%M"),
        "createdAt": (
            local_now.astimezone(timezone.utc)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z")
        ),
        "items": items,
        "totalItems": sum(item["qty"] for item in items),
        "notes": body.notes,
        "status": "pending",
    }
    await db["material_orders"].insert_one(order)
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
