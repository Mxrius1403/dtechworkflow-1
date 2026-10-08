from bson import ObjectId
from core.database import db
from core.models import BaseDocument
from core.security import require_roles
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

router = APIRouter(
    prefix="/api/suppliers",
    tags=["suppliers"],
)
MANAGERS = Depends(require_roles("owner", "manager"))


class SupplierCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Enter a supplier name.")
        return value


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[MANAGERS])
async def create_supplier(body: SupplierCreate) -> dict:
    supplier = {"_id": str(ObjectId()), "name": body.name}
    await db["suppliers"].insert_one(supplier)
    return BaseDocument.from_mongo(supplier).to_api()


@router.patch("/{supplier_id}", dependencies=[MANAGERS])
async def update_supplier(supplier_id: str, body: SupplierCreate) -> dict:
    result = await db["suppliers"].update_one(
        {"_id": supplier_id}, {"$set": {"name": body.name}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found.")
    return {"id": supplier_id, "name": body.name}


@router.delete("/{supplier_id}", dependencies=[MANAGERS])
async def delete_supplier(supplier_id: str) -> dict:
    result = await db["suppliers"].delete_one({"_id": supplier_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found.")
    return {"id": supplier_id, "deleted": True}
