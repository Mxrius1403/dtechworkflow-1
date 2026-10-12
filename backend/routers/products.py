from bson import ObjectId
from core.database import db
from core.security import current_account, require_roles
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

router = APIRouter(prefix="/api/products", tags=["products"])
MANAGERS = Depends(require_roles("owner", "manager"))


class ProductCreate(BaseModel):
    refNo: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=200)
    producer: str = Field(min_length=1, max_length=200)
    supplierId: str = Field(min_length=1, max_length=100)
    unit: str = Field(min_length=1, max_length=100)
    quantity: str = Field(min_length=1, max_length=100)
    measure: str = Field(default="", max_length=100)

    @field_validator("refNo", "title", "producer", "supplierId", "unit", "quantity")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value


class ProductImport(BaseModel):
    products: list[ProductCreate] = Field(min_length=1, max_length=1000)


async def validate_supplier(supplier_id: str) -> None:
    supplier = await db["suppliers"].find_one({"_id": supplier_id})
    if supplier is None:
        raise HTTPException(status_code=422, detail="Select a valid supplier.")


@router.get("", dependencies=[Depends(current_account)])
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


@router.post("/import", status_code=status.HTTP_201_CREATED, dependencies=[MANAGERS])
async def import_products(body: ProductImport) -> dict:
    seen_refs = set()
    supplier_ids = set()
    for product in body.products:
        ref_no = product.refNo.casefold()
        if ref_no in seen_refs:
            raise HTTPException(
                status_code=409,
                detail=f"Product code '{product.refNo}' occurs more than once in the import.",
            )
        seen_refs.add(ref_no)
        supplier_ids.add(product.supplierId)

    for supplier_id in supplier_ids:
        await validate_supplier(supplier_id)

    existing_products = await db["products"].find().to_list(10_000)
    existing_refs = {
        str(product.get("refNo", "")).casefold() for product in existing_products
    }
    duplicates = sorted(seen_refs & existing_refs)
    if duplicates:
        raise HTTPException(
            status_code=409,
            detail=f"Product code '{duplicates[0]}' already exists.",
        )

    documents = [
        {"_id": str(ObjectId()), **product.model_dump()} for product in body.products
    ]
    await db["products"].insert_many(documents)
    return {
        "imported": len(documents),
        "products": [
            {"id": product["_id"], **{key: value for key, value in product.items() if key != "_id"}}
            for product in documents
        ],
    }


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
