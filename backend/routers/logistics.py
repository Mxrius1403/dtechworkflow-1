import re
import secrets
from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Literal

from core.case_history import log_case_event
from core.collections import (
    AUTH_USERS,
    CLINIC_CONTACTS,
    SETTINGS,
)
from core.clinic_contacts import decrypt_contact_fields, encrypt_contact_fields
from core.database import db
from core.models import BaseDocument
from core.security import current_account, hash_password, require_roles
from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

router = APIRouter(prefix="/api", tags=["logistics"])
MANAGERS = Depends(require_roles("owner", "manager"))


class DeliveryInput(BaseModel):
    clinicId: str = Field(min_length=1, max_length=100)
    caseNumber: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9._/-]+$")
    productionCaseId: str | None = None
    productionConfirmedAt: str | None = None


class CollectionInput(BaseModel):
    clinicId: str = Field(min_length=1, max_length=100)
    notes: str = Field(default="", max_length=500)


class RouteCreate(BaseModel):
    date: date
    driverId: str = Field(min_length=1, max_length=100)
    deliveries: list[DeliveryInput] = Field(default_factory=list, max_length=500)
    collections: list[CollectionInput] = Field(default_factory=list, max_length=500)


class StopCreate(BaseModel):
    clinicId: str = Field(min_length=1, max_length=100)
    type: Literal["collection", "delivery"]
    caseNumber: str | None = Field(
        default=None, max_length=64, pattern=r"^[A-Za-z0-9._/-]+$"
    )
    notes: str = Field(default="", max_length=500)


class StopTransfer(BaseModel):
    driverId: str = Field(min_length=1, max_length=100)
    routeDate: date | None = None


class ClinicSave(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    address: str = Field(min_length=1, max_length=500)
    eircode: str = Field(min_length=1, max_length=20)
    email: str = Field(default="", max_length=320)
    phone: str = Field(default="", max_length=100)
    contact: str = Field(default="", max_length=200)
    notes: str = Field(default="", max_length=2000)
    active: bool = True

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip()
        if value and not re.fullmatch(r"\S+@\S+\.\S+", value):
            raise ValueError("Enter a valid clinic email address.")
        return value


class ClinicImport(BaseModel):
    clinics: list[ClinicSave] = Field(min_length=1, max_length=1000)


class DriverCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=12, max_length=72)
    active: bool = True


class DriverSave(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=12, max_length=72)
    active: bool = True


def normalized_email(value: str) -> str:
    try:
        return validate_email(value, check_deliverability=False).normalized.lower()
    except EmailNotValidError as error:
        raise HTTPException(
            status_code=422, detail="Enter a valid email address."
        ) from error


def check_password_bytes(password: str) -> None:
    if len(password.encode("utf-8")) > 72:
        raise HTTPException(
            status_code=422,
            detail="Password must be no longer than 72 UTF-8 bytes.",
        )


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def allocate_entity_id(
    collection_name: str, counter_field: str, prefix: str
) -> str:
    ids = db[collection_name].find(
        {"_id": {"$regex": f"^{re.escape(prefix)}\\d+$"}}, {"_id": 1}
    )
    highest_existing_number = 0
    async for document in ids:
        highest_existing_number = max(
            highest_existing_number, int(document["_id"][len(prefix) :])
        )
    await db[SETTINGS].find_one_and_update(
        {"_id": "app"},
        {"$max": {counter_field: highest_existing_number}},
        upsert=True,
    )
    settings = await db[SETTINGS].find_one_and_update(
        {"_id": "app"},
        {"$inc": {counter_field: 1}},
        return_document=ReturnDocument.AFTER,
    )
    if not settings:
        raise RuntimeError(f"Could not advance the {counter_field} counter.")
    return f"{prefix}{settings[counter_field]:04d}"


async def require_clinic(clinic_id: str) -> dict:
    clinic = await db["clinics"].find_one({"_id": clinic_id})
    if not clinic or clinic.get("active") is False:
        raise HTTPException(status_code=422, detail="Select an active clinic.")
    return clinic


async def allocate_route_id(route_date: str) -> str:
    prefix = f"R{route_date.replace('-', '')}-"
    existing = (
        await db["routes"]
        .find({"_id": {"$regex": f"^{prefix}"}}, {"_id": 1})
        .to_list(10_000)
    )
    sequence = (
        max(
            (
                int(str(route["_id"])[len(prefix) :])
                for route in existing
                if str(route["_id"])[len(prefix) :].isdigit()
            ),
            default=0,
        )
        + 1
    )
    return f"{prefix}{sequence:03d}"


async def new_route(route_date: str, driver: dict, creator: dict) -> dict:
    created_at = now_iso()
    route_id = await allocate_route_id(route_date)
    settings = await db[SETTINGS].find_one({"_id": "app"}) or {}
    route = {
        "_id": route_id,
        "date": route_date,
        "driverId": driver["_id"],
        "driverUid": driver.get("uid", f"u-{str(driver['_id']).lower()}"),
        "status": "published",
        "startEircode": settings.get("startEircode", ""),
        "stopIds": [],
        "totalStops": 0,
        "createdAt": created_at,
        "createdByUid": str(creator["_id"]),
        "updatedAt": created_at,
    }
    await db["routes"].insert_one(route)
    return route


async def get_or_create_route(route_date: str, driver: dict, creator: dict) -> dict:
    route = await db["routes"].find_one(
        {
            "date": route_date,
            "driverId": driver["_id"],
            "status": {"$in": ["published", "started", "break"]},
        }
    )
    return route if route else await new_route(route_date, driver, creator)


async def add_stop(
    route: dict,
    clinic: dict,
    deliveries: list[dict],
    collections: list[dict],
) -> dict:
    assigned_stops = (
        await db["stops"]
        .find({"_id": {"$in": route.get("stopIds", [])}}, {"_id": 1, "order": 1})
        .to_list(10_000)
    )
    order = max((int(stop.get("order", 0)) for stop in assigned_stops), default=0) + 1
    sequence = (
        max(
            (
                int(str(stop["_id"]).rsplit("-S", 1)[1])
                for stop in assigned_stops
                if "-S" in str(stop["_id"])
                and str(stop["_id"]).rsplit("-S", 1)[1].isdigit()
            ),
            default=0,
        )
        + 1
    )
    stop_id = f"{route['_id']}-S{sequence:03d}"
    created_at = now_iso()
    stop = {
        "_id": stop_id,
        "routeId": route["_id"],
        "clinicId": clinic["_id"],
        "order": order,
        "status": "pending",
        "arrived": False,
        "deliveryCompleted": False,
        "collectionCompleted": False,
        "deliveries": [
            {**item, "clinicId": clinic["_id"], "status": "pending"}
            for item in deliveries
        ],
        "collections": [
            {**item, "clinicId": clinic["_id"], "status": "pending"}
            for item in collections
        ],
        "createdAt": created_at,
    }
    route["stopIds"].append(stop_id)
    route["totalStops"] = len(route["stopIds"])
    route["updatedAt"] = created_at
    await db["stops"].insert_one(stop)
    await db["routes"].update_one(
        {"_id": route["_id"]},
        {
            "$set": {
                "stopIds": route["stopIds"],
                "totalStops": route["totalStops"],
                "updatedAt": created_at,
            }
        },
    )
    return stop


async def log_stop_case_events(
    stop: dict, route: dict, action: str, actor: dict | None
) -> None:
    """Write `action` to the history of every case delivered by `stop`."""
    deliveries = stop.get("deliveries") or []
    if not deliveries:
        return
    clinic = await db["clinics"].find_one({"_id": stop.get("clinicId")})
    driver = await db["drivers"].find_one({"_id": route.get("driverId")})
    context = (
        f"route {route['_id']} on {route.get('date', '?')}, driver "
        f"{(driver or {}).get('name') or route.get('driverId', '?')}, clinic "
        f"{(clinic or {}).get('name') or stop.get('clinicId', '?')}"
    )
    for delivery in deliveries:
        if delivery.get("productionCaseId"):
            query = {"_id": delivery["productionCaseId"]}
        elif delivery.get("caseNumber"):
            query = {"code": delivery["caseNumber"], "deleted": {"$ne": True}}
        else:
            continue
        case = await db["cases"].find_one(query)
        if case:
            await log_case_event(db, case, f"{action} ({context})", actor)


async def active_driver(driver_id: str) -> dict:
    driver = await db["drivers"].find_one({"_id": driver_id, "active": {"$ne": False}})
    if not driver:
        raise HTTPException(status_code=422, detail="Select an active driver.")
    return driver


async def notify_driver_of_stop(route: dict, stop: dict, clinic: dict) -> None:
    await db["notifications"].insert_one(
        {
            "_id": f"N{secrets.token_hex(6).upper()}",
            "driverUid": route["driverUid"],
            "routeId": route["_id"],
            "stopId": stop["_id"],
            "clinicId": clinic["_id"],
            "message": f"New stop added: {clinic['name']}. Choose its position in your remaining route.",
            "createdAt": now_iso(),
            "read": False,
            "type": "urgent_stop",
        }
    )


@router.get(
    "/clinics/{clinic_id}/contact",
    dependencies=[Depends(require_roles("owner", "manager"))],
)
async def clinic_contact(clinic_id: str) -> dict:
    """Return encrypted contact fields only to managers, migrating legacy plaintext records."""
    doc = await db[CLINIC_CONTACTS].find_one({"_id": clinic_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Clinic not found")
    if "encryptedData" in doc:
        fields = decrypt_contact_fields(clinic_id, doc["encryptedData"])
    else:
        fields = {
            key: doc.get(key, "") for key in ("email", "phone", "contact", "notes")
        }
        await db[CLINIC_CONTACTS].update_one(
            {"_id": clinic_id, "encryptedData": {"$exists": False}},
            {
                "$set": {"encryptedData": encrypt_contact_fields(clinic_id, fields)},
                "$unset": {"email": "", "phone": "", "contact": "", "notes": ""},
            },
        )
    return {"id": clinic_id, **fields}


@router.post("/routes", status_code=status.HTTP_201_CREATED, dependencies=[MANAGERS])
async def create_route(
    body: RouteCreate, creator: dict = Depends(current_account)
) -> dict:
    if not body.deliveries and not body.collections:
        raise HTTPException(
            status_code=422, detail="Add at least one delivery or collection."
        )
    driver = await active_driver(body.driverId)
    grouped: dict[str, dict[str, list[dict]]] = defaultdict(
        lambda: {"deliveries": [], "collections": []}
    )
    for delivery in body.deliveries:
        await require_clinic(delivery.clinicId)
        if delivery.productionCaseId:
            production_case_query = {
                "_id": delivery.productionCaseId,
                "status": {"$in": ["queue", "production", "completed"]},
                "deleted": {"$ne": True},
                "removedFromQueue": {"$ne": True},
                "code": delivery.caseNumber,
            }
            if delivery.productionConfirmedAt is not None:
                production_case_query["managerConfirmedAt"] = (
                    delivery.productionConfirmedAt
                    if delivery.productionConfirmedAt
                    else {"$in": [None, ""]}
                )
            production_case = await db["cases"].find_one(production_case_query)
            if not production_case:
                raise HTTPException(
                    status_code=422,
                    detail="A selected case is no longer available.",
                )
            already_assigned = await db["stops"].find_one(
                {
                    "deliveries": {
                        "$elemMatch": {
                            "productionCaseId": delivery.productionCaseId,
                            "productionConfirmedAt": (
                                delivery.productionConfirmedAt
                                if delivery.productionConfirmedAt is not None
                                else {"$in": [None, ""]}
                            ),
                        }
                    },
                }
            )
            if already_assigned:
                raise HTTPException(
                    status_code=409,
                    detail="A selected case is already assigned to a route.",
                )
        grouped[delivery.clinicId]["deliveries"].append(
            {
                "caseNumber": delivery.caseNumber,
                **(
                    {"productionCaseId": delivery.productionCaseId}
                    if delivery.productionCaseId
                    else {}
                ),
                **(
                    {"productionConfirmedAt": delivery.productionConfirmedAt}
                    if delivery.productionConfirmedAt
                    else {}
                ),
            }
        )
    for collection in body.collections:
        await require_clinic(collection.clinicId)
        grouped[collection.clinicId]["collections"].append(
            {"notes": collection.notes.strip()}
        )
    route = await get_or_create_route(body.date.isoformat(), driver, creator)
    has_confirmed_plan = bool(
        await db["route_plans"].find_one({"_id": route["_id"], "confirmed": True})
    )
    for clinic_id, items in grouped.items():
        clinic = await require_clinic(clinic_id)
        for deliveries, collections in (
            (items["deliveries"], []),
            ([], items["collections"]),
        ):
            if not deliveries and not collections:
                continue
            stop = await add_stop(route, clinic, deliveries, collections)
            await log_stop_case_events(stop, route, "Added to delivery route", creator)
            if has_confirmed_plan:
                await notify_driver_of_stop(route, stop, clinic)
    return BaseDocument.from_mongo(
        await db["routes"].find_one({"_id": route["_id"]})
    ).to_api()


@router.post(
    "/routes/{route_id}/stops",
    status_code=status.HTTP_201_CREATED,
    dependencies=[MANAGERS],
)
async def append_route_stop(
    route_id: str,
    body: StopCreate,
    actor: dict = Depends(current_account),
) -> dict:
    route = await db["routes"].find_one({"_id": route_id})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found.")
    if route.get("status") not in ("published", "started", "break"):
        raise HTTPException(
            status_code=409, detail="This route can no longer be changed."
        )
    clinic = await require_clinic(body.clinicId)
    if body.type != "collection" and not body.caseNumber:
        raise HTTPException(
            status_code=422, detail="Select a delivery case."
        )
    deliveries = [{"caseNumber": body.caseNumber}] if body.type != "collection" else []
    collections = [{"notes": body.notes.strip()}] if body.type != "delivery" else []
    has_confirmed_plan = bool(
        await db["route_plans"].find_one({"_id": route_id, "confirmed": True})
    )
    stop = await add_stop(route, clinic, deliveries, collections)
    await log_stop_case_events(stop, route, "Added to delivery route", actor)
    if has_confirmed_plan:
        await notify_driver_of_stop(route, stop, clinic)
    return BaseDocument.from_mongo(
        await db["stops"].find_one({"_id": stop["_id"]})
    ).to_api()


@router.patch("/routes/{route_id}/stops/{stop_id}/transfer", dependencies=[MANAGERS])
async def transfer_route_stop(
    route_id: str,
    stop_id: str,
    body: StopTransfer,
    creator: dict = Depends(current_account),
) -> dict:
    source = await db["routes"].find_one({"_id": route_id})
    stop = await db["stops"].find_one({"_id": stop_id, "routeId": route_id})
    if not source or not stop:
        raise HTTPException(status_code=404, detail="Route stop not found.")
    if stop.get("status") in ("arrived", "completed") or stop.get("arrived"):
        raise HTTPException(
            status_code=409,
            detail="An arrived or completed stop cannot be transferred.",
        )
    driver = await active_driver(body.driverId)
    route_date = (body.routeDate or date.fromisoformat(source["date"])).isoformat()
    if body.driverId == source["driverId"] and route_date == source["date"]:
        raise HTTPException(
            status_code=422, detail="Choose a different driver or route date."
        )
    target = await get_or_create_route(route_date, driver, creator)
    source["stopIds"] = [sid for sid in source["stopIds"] if sid != stop_id]
    source["totalStops"] = len(source["stopIds"])
    source["updatedAt"] = now_iso()
    await db["routes"].update_one(
        {"_id": source["_id"]},
        {
            "$set": {
                "stopIds": source["stopIds"],
                "totalStops": source["totalStops"],
                "updatedAt": source["updatedAt"],
            }
        },
    )
    stop["routeId"] = target["_id"]
    target_stops = (
        await db["stops"]
        .find({"_id": {"$in": target.get("stopIds", [])}}, {"order": 1})
        .to_list(10_000)
    )
    stop["order"] = (
        max((int(item.get("order", 0)) for item in target_stops), default=0) + 1
    )
    target["stopIds"].append(stop_id)
    target["totalStops"] = len(target["stopIds"])
    target["updatedAt"] = now_iso()
    await db["stops"].update_one(
        {"_id": stop_id}, {"$set": {"routeId": target["_id"], "order": stop["order"]}}
    )
    await db["routes"].update_one(
        {"_id": target["_id"]},
        {
            "$set": {
                "stopIds": target["stopIds"],
                "totalStops": target["totalStops"],
                "updatedAt": target["updatedAt"],
            }
        },
    )
    await db["route_plans"].delete_many(
        {"_id": {"$in": [source["_id"], target["_id"]]}}
    )
    clinic = await db["clinics"].find_one({"_id": stop["clinicId"]})
    await db["notifications"].delete_many({"routeId": route_id, "stopId": stop_id})
    await notify_driver_of_stop(target, stop, clinic)
    await log_stop_case_events(
        stop,
        target,
        f"Delivery stop transferred from route {source['_id']}",
        creator,
    )
    return BaseDocument.from_mongo(
        await db["routes"].find_one({"_id": target["_id"]})
    ).to_api()


@router.delete(
    "/routes/{route_id}/stops/{stop_id}", dependencies=[MANAGERS]
)
async def delete_route_stop(
    route_id: str,
    stop_id: str,
    actor: dict = Depends(current_account),
) -> dict:
    route = await db["routes"].find_one({"_id": route_id})
    stop = await db["stops"].find_one({"_id": stop_id, "routeId": route_id})
    if not route or not stop:
        raise HTTPException(status_code=404, detail="Route stop not found.")
    if route.get("status") not in ("published", "started", "break"):
        raise HTTPException(
            status_code=409, detail="This route can no longer be changed."
        )
    if stop.get("status") in ("arrived", "completed") or stop.get("arrived"):
        raise HTTPException(
            status_code=409,
            detail="An arrived or completed stop cannot be deleted.",
        )

    route["stopIds"] = [
        assigned_id for assigned_id in route["stopIds"] if assigned_id != stop_id
    ]
    route["totalStops"] = len(route["stopIds"])
    route["updatedAt"] = now_iso()
    await db["routes"].update_one(
        {"_id": route_id},
        {
            "$set": {
                "stopIds": route["stopIds"],
                "totalStops": route["totalStops"],
                "updatedAt": route["updatedAt"],
            }
        },
    )
    await log_stop_case_events(
        stop, route, "Removed from delivery route", actor
    )
    await db["stops"].delete_one({"_id": stop_id, "routeId": route_id})
    await db["notifications"].delete_many({"routeId": route_id, "stopId": stop_id})
    await db["route_plans"].delete_many({"_id": route_id})
    return {"id": stop_id, "routeId": route_id, "deleted": True}


@router.delete("/routes/{route_id}", dependencies=[MANAGERS])
async def delete_route(
    route_id: str, actor: dict = Depends(current_account)
) -> dict:
    route = await db["routes"].find_one({"_id": route_id})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found.")
    if route.get("status") not in ("published", "cancelled"):
        raise HTTPException(
            status_code=409, detail="A route that has started cannot be deleted."
        )
    await remove_route(route, actor)
    return {"id": route_id, "deleted": True}


async def remove_route(route: dict, actor: dict | None = None) -> None:
    route_id = route["_id"]
    stops = await db["stops"].find({"routeId": route_id}).to_list(None)
    for stop in stops:
        await log_stop_case_events(
            stop, route, "Removed from delivery route (route deleted)", actor
        )
    await db["stops"].delete_many({"routeId": route_id})
    await db["route_plans"].delete_many({"_id": route_id})
    await db["notifications"].delete_many({"routeId": route_id})
    await db["routes"].delete_one({"_id": route_id})


async def save_clinic(clinic_id: str | None, body: ClinicSave) -> dict:
    name = body.name.strip()
    address = body.address.strip()
    eircode = body.eircode.strip().upper()
    if not name or not address or not eircode:
        raise HTTPException(
            status_code=422, detail="Complete clinic name, address and Eircode."
        )
    if clinic_id:
        existing = await db["clinics"].find_one({"_id": clinic_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Clinic not found.")
        clinic = {
            **existing,
            "name": name,
            "address": address,
            "eircode": eircode,
            "active": body.active,
            "hasEmail": bool(body.email.strip()),
        }
        await db["clinics"].replace_one({"_id": clinic_id}, clinic)
    else:
        for _ in range(3):
            clinic_id = await allocate_entity_id("clinics", "nextClinicNumber", "C")
            clinic = {
                "_id": clinic_id,
                "name": name,
                "address": address,
                "eircode": eircode,
                "active": body.active,
                "hasEmail": bool(body.email.strip()),
            }
            try:
                await db["clinics"].insert_one(clinic)
                break
            except DuplicateKeyError:
                continue
        else:
            raise HTTPException(
                status_code=409, detail="Could not allocate a unique clinic ID."
            )
    await db[CLINIC_CONTACTS].replace_one(
        {"_id": clinic_id},
        {
            "_id": clinic_id,
            "encryptedData": encrypt_contact_fields(
                clinic_id,
                {
                    "email": body.email.strip(),
                    "phone": body.phone.strip(),
                    "contact": body.contact.strip(),
                    "notes": body.notes.strip(),
                },
            ),
        },
        upsert=True,
    )
    return BaseDocument.from_mongo(clinic).to_api()


@router.put("/clinics/{clinic_id}", dependencies=[MANAGERS])
async def update_clinic(clinic_id: str, body: ClinicSave) -> dict:
    return await save_clinic(clinic_id, body)


@router.post("/clinics", status_code=status.HTTP_201_CREATED, dependencies=[MANAGERS])
async def create_clinic(body: ClinicSave) -> dict:
    return await save_clinic(None, body)


@router.post("/clinics/import", dependencies=[MANAGERS])
async def import_clinics(body: ClinicImport) -> dict:
    imported = []
    for clinic in body.clinics:
        current = await db["clinics"].find_one(
            {
                "name": {
                    "$regex": f"^{re.escape(clinic.name.strip())}$",
                    "$options": "i",
                },
                "eircode": clinic.eircode.strip().upper(),
            }
        )
        imported.append(
            await save_clinic(str(current["_id"]) if current else None, clinic)
        )
    return {"clinics": imported}


@router.post("/drivers", status_code=status.HTTP_201_CREATED)
async def create_driver(
    body: DriverCreate,
    creator: dict = Depends(require_roles("owner", "manager")),
) -> dict:
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Enter a driver name.")
    check_password_bytes(body.password)
    email = normalized_email(str(body.email))
    if await db[AUTH_USERS].find_one({"email": email}):
        raise HTTPException(
            status_code=409, detail="An account with this email already exists."
        )
    password_hash = hash_password(body.password)
    for _ in range(3):
        driver_id = await allocate_entity_id("drivers", "nextDriverNumber", "D")
        if await db[AUTH_USERS].find_one({"_id": driver_id}):
            continue
        driver = {
            "_id": driver_id,
            "uid": f"u-{driver_id.lower()}",
            "name": name,
            "active": body.active,
        }
        account = {
            "_id": driver_id,
            "name": name,
            "email": email,
            "passwordHash": password_hash,
            "role": "driver",
            "active": body.active,
            "authVersion": 0,
            "createdAt": now_iso(),
            "createdBy": str(creator["_id"]),
        }
        try:
            await db[AUTH_USERS].insert_one(account)
        except DuplicateKeyError:
            if await db[AUTH_USERS].find_one({"email": email}):
                raise HTTPException(
                    status_code=409,
                    detail="An account with this email already exists.",
                )
            continue
        try:
            await db["drivers"].insert_one(driver)
        except DuplicateKeyError:
            await db[AUTH_USERS].delete_one({"_id": driver_id})
            continue
        break
    else:
        raise HTTPException(
            status_code=409, detail="Could not allocate a unique driver ID."
        )
    return BaseDocument.from_mongo(driver).to_api()


@router.delete("/drivers/{driver_id}", dependencies=[MANAGERS])
async def delete_driver(
    driver_id: str,
    force: bool = False,
    actor: dict = Depends(current_account),
) -> dict:
    driver = await db["drivers"].find_one({"_id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found.")
    if driver.get("active") is not False:
        raise HTTPException(
            status_code=409, detail="Deactivate the driver before deleting."
        )
    open_routes = await db["routes"].find(
        {"driverId": driver_id, "status": {"$nin": ["completed", "cancelled"]}}
    ).to_list(length=None)
    if open_routes and not force:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "driver_has_routes",
                "routes": [
                    {"id": r["_id"], "date": r.get("date"), "status": r.get("status")}
                    for r in open_routes
                ],
            },
        )
    for route in open_routes:
        await remove_route(route, actor)
    account = await db[AUTH_USERS].find_one({"_id": driver_id})
    if account and account.get("role") == "driver":
        await db[AUTH_USERS].delete_one({"_id": driver_id})
    await db["drivers"].delete_one({"_id": driver_id})
    return {"id": driver_id, "deleted": True, "deletedRoutes": len(open_routes)}


@router.patch("/drivers/{driver_id}", dependencies=[MANAGERS])
async def update_driver(
    driver_id: str,
    body: DriverSave,
    force: bool = False,
    actor: dict = Depends(current_account),
) -> dict:
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Enter a driver name.")
    if body.password:
        check_password_bytes(body.password)
    driver = await db["drivers"].find_one({"_id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found.")
    open_routes = []
    if not body.active:
        open_routes = await db["routes"].find(
            {"driverId": driver_id, "status": {"$nin": ["completed", "cancelled"]}}
        ).to_list(length=None)
        if open_routes and not force:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "driver_has_routes",
                    "routes": [
                        {"id": r["_id"], "date": r.get("date"), "status": r.get("status")}
                        for r in open_routes
                    ],
                },
            )
    account = await db[AUTH_USERS].find_one({"_id": driver_id})
    if account and account.get("role") != "driver":
        raise HTTPException(status_code=409, detail="Driver account is invalid.")

    email = normalized_email(str(body.email)) if body.email else None
    if email:
        other = await db[AUTH_USERS].find_one({"email": email})
        if other and other["_id"] != driver_id:
            raise HTTPException(
                status_code=409, detail="An account with this email already exists."
            )
    if account:
        changes = {"name": name, "active": body.active}
        if email:
            changes["email"] = email
        if body.password:
            changes["passwordHash"] = hash_password(body.password)
        update = {"$set": changes}
        if body.password or not body.active or (email and email != account.get("email")):
            update["$inc"] = {"authVersion": 1}
        try:
            await db[AUTH_USERS].update_one({"_id": driver_id}, update)
        except DuplicateKeyError as error:
            raise HTTPException(
                status_code=409, detail="An account with this email already exists."
            ) from error
    elif email and body.password:
        try:
            await db[AUTH_USERS].insert_one(
                {
                    "_id": driver_id,
                    "name": name,
                    "email": email,
                    "passwordHash": hash_password(body.password),
                    "role": "driver",
                    "active": body.active,
                    "authVersion": 0,
                    "createdAt": now_iso(),
                }
            )
        except DuplicateKeyError as error:
            raise HTTPException(
                status_code=409, detail="An account with this email already exists."
            ) from error
    for route in open_routes:
        await remove_route(route, actor)
    await db["drivers"].update_one(
        {"_id": driver_id}, {"$set": {"name": name, "active": body.active}}
    )
    return BaseDocument.from_mongo(
        await db["drivers"].find_one({"_id": driver_id})
    ).to_api()
