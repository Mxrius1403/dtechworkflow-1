from bson import ObjectId
from core.database import db
from core.security import require_roles
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from seed.loader import ensure_demo_data

router = APIRouter(
    prefix="/api/products",
    tags=["products"],
    dependencies=[Depends(ensure_demo_data)],
)
MANAGERS = Depends(require_roles("owner", "manager"))


class ProductCreate(BaseModel):
    refNo: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=200)
    producer: str = Field(min_length=1, max_length=200)
    supplierId: str = Field(min_length=1, max_length=100)
    unit: str = Field(min_length=1, max_length=100)
    quantity: str = Field(min_length=1, max_length=100)
    measure: str = Field(min_length=1, max_length=100)

    @field_validator("refNo", "title", "producer", "supplierId", "unit", "quantity", "measure")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value


async def validate_supplier(supplier_id: str) -> None:
    supplier = await db["suppliers"].find_one({"_id": supplier_id})
    if supplier is None:
        raise HTTPException(status_code=422, detail="Select a valid supplier.")


@router.get("", dependencies=[MANAGERS])
async def list_products() -> list[dict]:
    products = await db["products"].find().to_list(10_000)
    return [
        {"id": str(product["_id"]), **{key: value for key, value in product.items() if key != "_id"}}
        for product in products
    ]


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[MANAGERS])
async def create_product(body: ProductCreate) -> dict:
    await validate_supplier(body.supplierId)
    product = {"_id": str(ObjectId()), **body.model_dump()}
    await db["products"].insert_one(product)
    return {"id": product["_id"], **body.model_dump()}


@router.patch("/{product_id}", dependencies=[MANAGERS])
async def update_product(product_id: str, body: ProductCreate) -> dict:
    await validate_supplier(body.supplierId)
    result = await db["products"].update_one(
        {"_id": product_id}, {"$set": body.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found.")
    return {"id": product_id, **body.model_dump()}


@router.delete("/{product_id}", dependencies=[MANAGERS])
async def delete_product(product_id: str) -> dict:
    result = await db["products"].delete_one({"_id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found.")
    return {"id": product_id, "deleted": True}
