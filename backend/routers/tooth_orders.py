from datetime import datetime, timezone
from typing import Literal
from zoneinfo import ZoneInfo

from bson import ObjectId
from core.config import TIMEZONE
from core.database import db
from core.security import current_account, require_roles
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from seed.loader import ensure_demo_data

router = APIRouter(
    prefix="/api/tooth-orders",
    tags=["tooth orders"],
    dependencies=[Depends(ensure_demo_data)],
)


class ToothOrderItem(BaseModel):
    group: str = Field(min_length=1, max_length=80)
    tooth: str = Field(min_length=1, max_length=20)
    shade: str = Field(min_length=1, max_length=24)
    qty: int = Field(ge=1, le=999)

    @field_validator("group", "tooth", "shade")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value


class ToothOrderSubmit(BaseModel):
    items: list[ToothOrderItem] = Field(min_length=1, max_length=100)


class ToothOrderStatusUpdate(BaseModel):
    status: Literal["done"]


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("technician"))],
)
async def submit_tooth_order(
    body: ToothOrderSubmit,
    account: dict = Depends(current_account),
) -> dict:
    local_now = datetime.now(ZoneInfo(TIMEZONE))
    order = {
        "_id": str(ObjectId()),
        "technicianId": str(account["_id"]),
        "technician": account["name"],
        "date": local_now.date().isoformat(),
        "time": local_now.strftime("%H:%M"),
        "createdAt": (
            local_now.astimezone(timezone.utc)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z")
        ),
        "items": [item.model_dump() for item in body.items],
        "total": sum(item.qty for item in body.items),
        "status": "pending",
    }
    await db["tooth_orders"].insert_one(order)
    order["id"] = order.pop("_id")
    return order


@router.patch(
    "/{order_id}/status",
    dependencies=[Depends(require_roles("owner", "manager"))],
)
async def update_tooth_order_status(
    order_id: str,
    body: ToothOrderStatusUpdate,
) -> dict:
    result = await db["tooth_orders"].update_one(
        {"_id": order_id},
        {"$set": {"status": body.status}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tooth order not found.")
    return {"id": order_id, "status": body.status}


@router.delete(
    "/{order_id}",
    dependencies=[Depends(require_roles("owner", "manager"))],
)
async def delete_tooth_order(order_id: str) -> dict:
    result = await db["tooth_orders"].delete_one({"_id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tooth order not found.")
    return {"id": order_id, "deleted": True}
