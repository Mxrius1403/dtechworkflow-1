from datetime import date, datetime, timezone
from typing import Literal
from zoneinfo import ZoneInfo

from bson import ObjectId
from core.config import TIMEZONE
from core.database import db
from core.models import BaseDocument
from core.security import current_account
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator
from pymongo import ReturnDocument
from seed.calendar import is_production_day
from seed.loader import ensure_demo_data
from seed.reference import ARCH_OPTIONS, SERVICE_TYPES

router = APIRouter(
    prefix="/api/receiving",
    tags=["receiving"],
    dependencies=[Depends(ensure_demo_data)],
)


class ReceiveCase(BaseModel):
    code: str = Field(
        min_length=1, max_length=64, pattern=r"^[A-Za-z0-9._/-]+$"
    )
    department: Literal["prosthesis", "ortho", "digital"]
    productionDate: date
    serviceTypes: list[str] = Field(
        default_factory=list, max_length=len(SERVICE_TYPES)
    )
    arch: str = ""
    caseId: str | None = Field(default=None, min_length=1, max_length=100)

    @model_validator(mode="after")
    def validate_work_details(self):
        if any(item not in SERVICE_TYPES for item in self.serviceTypes):
            raise ValueError("Select valid service types.")
        if self.department == "prosthesis":
            if not self.serviceTypes or self.arch not in ARCH_OPTIONS:
                raise ValueError(
                    "Select at least one service type and a valid arch."
                )
        elif self.serviceTypes or self.arch:
            raise ValueError(
                "Service types and arch are only used for prosthesis cases."
            )
        return self


def _receiving_day() -> date:
    return datetime.now(ZoneInfo(TIMEZONE)).date()


def _now() -> tuple[str, date, str]:
    local_now = datetime.now(ZoneInfo(TIMEZONE))
    timestamp = (
        local_now.astimezone(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )
    return timestamp, local_now.date(), local_now.strftime("%H:%M")


async def receiving_account(account: dict = Depends(current_account)) -> dict:
    if account.get("role") in ("owner", "manager"):
        return account
    if (
        account.get("role") == "technician"
        and account.get("department") == "digital"
    ):
        return account
    raise HTTPException(status_code=403, detail="Insufficient permissions.")


def _validate_production_date(production_date: date) -> None:
    if production_date < _receiving_day():
        raise HTTPException(
            status_code=422, detail="Production date cannot be in the past."
        )
    if not is_production_day(production_date):
        raise HTTPException(
            status_code=422,
            detail=(
                "Production date must be a weekday and not an Irish public "
                "holiday."
            ),
        )


def _new_case(body: ReceiveCase, account: dict) -> dict:
    timestamp, received_date, received_time = _now()
    display_name = account.get("name", account.get("email", "Receiving"))
    return {
        "_id": str(ObjectId()),
        "code": body.code,
        "department": body.department,
        "status": "queue",
        "scheduledDate": body.productionDate.isoformat(),
        "originalScheduledDate": body.productionDate.isoformat(),
        "currentDueDate": body.productionDate.isoformat(),
        "missedScheduleDates": {},
        "receivedDate": received_date.isoformat(),
        "receivedAt": timestamp,
        "receivedTime": received_time,
        "serviceTypes": body.serviceTypes,
        "arch": body.arch,
        "attentionStatus": "active",
        "attentionNote": "",
        "overdue": False,
        "wasOverdue": False,
        "overdueReasonRequired": False,
        "overdueReason": "",
        "technicianId": "",
        "technician": "",
        "startedAt": "",
        "startedTime": "",
        "finishedAt": "",
        "finishedDate": "",
        "finishedTime": "",
        "finishedById": "",
        "finishedBy": "",
        "completionReviewRequired": False,
        "completionReviewStatus": "",
        "managerConfirmedAt": "",
        "workSessions": [],
        "createdAt": timestamp,
        "updatedAt": timestamp,
        "history": [
            {
                "at": timestamp,
                "action": (
                    f"Received and scheduled for "
                    f"{body.productionDate.isoformat()}"
                ),
                "by": display_name,
            }
        ],
    }


async def _create_or_reenter(body: ReceiveCase, account: dict) -> dict:
    _validate_production_date(body.productionDate)
    if account.get("role") == "technician" and body.department != "digital":
        raise HTTPException(
            status_code=403,
            detail="Digital Receiving can only receive digital cases.",
        )

    if body.caseId:
        existing = await db["cases"].find_one({"_id": body.caseId})
        if not existing or existing.get("code") != body.code:
            raise HTTPException(
                status_code=404, detail="Completed case not found."
            )
        if (
            account.get("role") == "technician"
            and existing.get("department") != "digital"
        ):
            raise HTTPException(
                status_code=403,
                detail="Digital Receiving can only re-enter digital cases.",
            )
        if existing.get("completionReviewStatus") == "pending":
            raise HTTPException(
                status_code=409,
                detail="This completion is awaiting Manager confirmation.",
            )
        if existing.get("status") != "completed":
            raise HTTPException(
                status_code=409,
                detail="Only completed cases can be re-entered.",
            )

        timestamp, received_date, received_time = _now()
        display_name = account.get("name", account.get("email", "Receiving"))
        cycle = {
            key: existing.get(key)
            for key in (
                "scheduledDate",
                "originalScheduledDate",
                "currentDueDate",
                "overdue",
                "status",
                "finishedAt",
                "arch",
                "serviceTypes",
            )
        }
        cycle["archivedAt"] = timestamp
        update = {
            "$set": {
                "department": body.department,
                "status": "queue",
                "scheduledDate": body.productionDate.isoformat(),
                "originalScheduledDate": body.productionDate.isoformat(),
                "currentDueDate": body.productionDate.isoformat(),
                "missedScheduleDates": {},
                "receivedDate": received_date.isoformat(),
                "receivedAt": timestamp,
                "receivedTime": received_time,
                "serviceTypes": body.serviceTypes,
                "arch": body.arch,
                "attentionStatus": "active",
                "attentionNote": "",
                "overdue": False,
                "wasOverdue": False,
                "overdueReasonRequired": False,
                "overdueReason": "",
                "technicianId": "",
                "technician": "",
                "startedAt": "",
                "startedTime": "",
                "finishedAt": "",
                "finishedDate": "",
                "finishedTime": "",
                "finishedById": "",
                "finishedBy": "",
                "completionReviewRequired": False,
                "completionReviewStatus": "",
                "managerConfirmedAt": "",
                "updatedAt": timestamp,
            },
            "$push": {
                "reentryCycles": cycle,
                "history": {
                    "at": timestamp,
                    "action": (
                        f"Re-entered for {body.productionDate.isoformat()}; "
                        "previous cycle archived"
                    ),
                    "by": display_name,
                },
            },
            "$unset": {
                "completionRequestedAt": "",
                "completionRequestedById": "",
                "completionRequestedBy": "",
                "managerConfirmedById": "",
                "managerConfirmedBy": "",
                "removedFromQueue": "",
            },
        }
        case = await db["cases"].find_one_and_update(
            {
                "_id": body.caseId,
                "status": "completed",
                "completionReviewStatus": {"$ne": "pending"},
            },
            update,
            return_document=ReturnDocument.AFTER,
        )
        if not case:
            raise HTTPException(
                status_code=409,
                detail=(
                    "The case changed before it could be re-entered. Refresh "
                    "and try again."
                ),
            )
        return BaseDocument.from_mongo(case).to_api()

    if await db["cases"].find_one({"code": body.code}):
        raise HTTPException(
            status_code=409,
            detail=(
                "A case with this number already exists. Refresh Receiving "
                "and try again."
            ),
        )
    case = _new_case(body, account)
    await db["cases"].insert_one(case)
    return BaseDocument.from_mongo(case).to_api()


@router.post("/cases", status_code=status.HTTP_201_CREATED)
async def create_received_case(
    body: ReceiveCase, account: dict = Depends(receiving_account)
) -> dict:
    return await _create_or_reenter(body, account)


@router.post("/cases/{case_id}/restore")
async def restore_received_case(
    case_id: str, account: dict = Depends(receiving_account)
) -> dict:
    existing = await db["cases"].find_one({"_id": case_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Case not found.")
    if (
        account.get("role") == "technician"
        and existing.get("department") != "digital"
    ):
        raise HTTPException(
            status_code=403,
            detail="Digital Receiving can only restore digital cases.",
        )
    if existing.get("status") != "removed":
        raise HTTPException(
            status_code=409, detail="Only removed cases can be restored."
        )

    timestamp, _, _ = _now()
    display_name = account.get("name", account.get("email", "Receiving"))
    case = await db["cases"].find_one_and_update(
        {"_id": case_id, "status": "removed"},
        {
            "$set": {
                "status": "queue",
                "removedFromQueue": False,
                "queueRestoredAt": timestamp,
                "queueRestoredById": str(account["_id"]),
                "queueRestoredBy": display_name,
                "updatedAt": timestamp,
            },
            "$push": {
                "history": {
                    "at": timestamp,
                    "action": "Restored to queue",
                    "by": display_name,
                }
            },
        },
        return_document=ReturnDocument.AFTER,
    )
    if not case:
        raise HTTPException(
            status_code=409,
            detail=(
                "The case changed before it could be restored. Refresh and "
                "try again."
            ),
        )
    return BaseDocument.from_mongo(case).to_api()
