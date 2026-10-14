from datetime import datetime, timezone
from typing import Literal

from bson import ObjectId
from core.collections import SERVICE_TYPES
from core.database import db
from core.service_types import SERVICE_TYPE_NAME_LIMIT, name_key, read_service_types
from core.security import require_roles
from core.workflow_constants import DEPARTMENT_LABELS, NO_SERVICE_TYPE
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from pymongo.errors import DuplicateKeyError

router = APIRouter(prefix="/api/service-types", tags=["service-types"])
MANAGERS = Depends(require_roles("owner", "manager"))
STAFF = Depends(require_roles("owner", "manager", "technician"))


class ServiceTypeName(BaseModel):
    name: str = Field(min_length=1, max_length=SERVICE_TYPE_NAME_LIMIT)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Enter a service type name.")
        if name_key(value) == name_key(NO_SERVICE_TYPE):
            raise ValueError("None is always available and cannot be added.")
        return value


class ServiceTypeCreate(ServiceTypeName):
    department: Literal["prosthesis", "ortho", "digital"]


def _duplicate(name: str, department: str) -> HTTPException:
    return HTTPException(
        status_code=409,
        detail=f"{name} already exists for {DEPARTMENT_LABELS[department]}.",
    )


async def _ensure_unique(department: str, name: str, own_id: str | None = None) -> None:
    existing = await db[SERVICE_TYPES].find_one(
        {"department": department, "nameKey": name_key(name)}
    )
    if existing and str(existing["_id"]) != own_id:
        raise _duplicate(existing["name"], department)


def _to_api(doc: dict) -> dict:
    return {"id": str(doc["_id"]), "department": doc["department"], "name": doc["name"]}


@router.get("", dependencies=[STAFF])
async def list_service_types() -> list[dict]:
    return await read_service_types(db)


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[MANAGERS])
async def create_service_type(body: ServiceTypeCreate) -> dict:
    await _ensure_unique(body.department, body.name)
    doc = {
        "_id": str(ObjectId()),
        "department": body.department,
        "name": body.name,
        "nameKey": name_key(body.name),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db[SERVICE_TYPES].insert_one(doc)
    except DuplicateKeyError:
        raise _duplicate(body.name, body.department) from None
    return _to_api(doc)


@router.patch("/{service_type_id}", dependencies=[MANAGERS])
async def rename_service_type(service_type_id: str, body: ServiceTypeName) -> dict:
    existing = await db[SERVICE_TYPES].find_one({"_id": service_type_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Service type not found.")
    await _ensure_unique(existing["department"], body.name, service_type_id)
    changes = {"name": body.name, "nameKey": name_key(body.name)}
    try:
        await db[SERVICE_TYPES].update_one({"_id": service_type_id}, {"$set": changes})
    except DuplicateKeyError:
        raise _duplicate(body.name, existing["department"]) from None
    return _to_api({**existing, **changes})


@router.delete("/{service_type_id}", dependencies=[MANAGERS])
async def delete_service_type(service_type_id: str) -> dict:
    result = await db[SERVICE_TYPES].delete_one({"_id": service_type_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service type not found.")
    return {"id": service_type_id, "deleted": True}
