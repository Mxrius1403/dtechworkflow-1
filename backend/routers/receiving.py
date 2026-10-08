import asyncio
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo

from bson import ObjectId
from core.collections import AUTH_USERS
from core.config import TIMEZONE
from core.database import db
from core.models import BaseDocument
from core.production_calendar import is_production_day
from core.workflow_constants import ARCH_OPTIONS, SERVICE_TYPES
from core.security import current_account
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator
from pymongo import ReturnDocument

logger = logging.getLogger(__name__)

COMPLETED_CASE_RETENTION = timedelta(days=10)

router = APIRouter(prefix="/api/receiving", tags=["receiving"])


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
        if not self.serviceTypes or self.arch not in ARCH_OPTIONS:
            raise ValueError(
                "Select at least one service type and a valid arch."
            )
        return self


class UpdateCase(BaseModel):
    department: Literal["prosthesis", "ortho", "digital"]
    status: Literal["queue", "production", "completed", "removed"]
    technicianId: str = Field(default="", max_length=100)
    operationalAt: datetime | None = None
    overdue: bool | None = None


class UpdateAttention(BaseModel):
    attentionStatus: Literal["active", "on_hold", "need_information"]
    attentionNote: str = Field(default="", max_length=100)

    @model_validator(mode="after")
    def validate_attention_note(self):
        self.attentionNote = self.attentionNote.strip()
        if self.attentionStatus != "active" and not self.attentionNote:
            raise ValueError("Enter a short reason.")
        return self


class UpdateOverdueReason(BaseModel):
    reason: str = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def validate_reason(self):
        self.reason = self.reason.strip()
        if not self.reason:
            raise ValueError("Enter a reason.")
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


async def expire_completed_cases(now: datetime | None = None) -> int:
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    timestamp = now.isoformat(timespec="milliseconds").replace("+00:00", "Z")
    cutoff = (now - COMPLETED_CASE_RETENTION).isoformat(
        timespec="milliseconds"
    ).replace("+00:00", "Z")
    result = await db["cases"].update_many(
        {
            "status": "completed",
            "finishedAt": {"$lte": cutoff},
            "deleted": {"$ne": True},
            "completionReviewStatus": {"$ne": "pending"},
        },
        {
            "$set": {
                "status": "removed",
                "removedFromQueue": True,
                "autoRemovedFromQueue": True,
                "queueRemovedAt": timestamp,
                "queueRemovedById": "system",
                "queueRemovedBy": "System",
                "previousQueueStatus": "completed",
                "updatedAt": timestamp,
            },
            "$push": {
                "history": {
                    "at": timestamp,
                    "action": "Automatically removed from queue after 10 days completed",
                    "by": "System",
                }
            },
        },
    )
    if result.modified_count:
        logger.info(
            "Automatically removed %s completed cases from the Receiving queue",
            result.modified_count,
        )
    return result.modified_count


async def completed_case_expiry_loop() -> None:
    while True:
        await asyncio.sleep(60)
        try:
            await expire_completed_cases()
        except Exception:
            logger.exception("Failed to expire completed Receiving cases")


async def receiving_account(account: dict = Depends(current_account)) -> dict:
    if account.get("role") in ("owner", "manager", "technician"):
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

    if body.caseId:
        existing = await db["cases"].find_one({"_id": body.caseId})
        if not existing or existing.get("code") != body.code:
            raise HTTPException(
                status_code=404, detail="Completed case not found."
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

    if await db["cases"].find_one(
        {"code": body.code, "deleted": {"$ne": True}}
    ):
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
    if existing.get("status") != "removed":
        raise HTTPException(
            status_code=409, detail="Only removed cases can be restored."
        )
    if existing.get("autoRemovedFromQueue"):
        raise HTTPException(
            status_code=409,
            detail=(
                "Cases automatically removed after 10 days can only be found "
                "in Case Search."
            ),
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


@router.post("/cases/{case_id}/remove")
async def remove_received_case(
    case_id: str, account: dict = Depends(receiving_account)
) -> dict:
    existing = await db["cases"].find_one({"_id": case_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Case not found.")
    if existing.get("status") not in ("queue", "production"):
        if existing.get("completionReviewStatus") == "pending":
            raise HTTPException(
                status_code=409,
                detail="This completion is awaiting Manager confirmation.",
            )
        raise HTTPException(
            status_code=409,
            detail="Only active queue or production cases can be removed.",
        )

    timestamp, _, _ = _now()
    display_name = account.get("name", account.get("email", "Receiving"))
    case = await db["cases"].find_one_and_update(
        {
            "_id": case_id,
            "status": existing["status"],
            "deleted": {"$ne": True},
            "completionReviewStatus": {"$ne": "pending"},
        },
        {
            "$set": {
                "status": "removed",
                "removedFromQueue": True,
                "autoRemovedFromQueue": False,
                "queueRemovedAt": timestamp,
                "queueRemovedById": str(account["_id"]),
                "queueRemovedBy": display_name,
                "previousQueueStatus": "queue",
                "updatedAt": timestamp,
            },
            "$push": {
                "history": {
                    "at": timestamp,
                    "action": "Removed from queue",
                    "by": display_name,
                }
            },
        },
        return_document=ReturnDocument.AFTER,
    )
    if not case:
        raise HTTPException(
            status_code=409,
            detail="The case changed before it could be removed. Refresh and try again.",
        )
    return BaseDocument.from_mongo(case).to_api()


@router.delete("/cases/{case_id}")
async def delete_received_case(
    case_id: str,
    account: dict = Depends(receiving_account),
) -> dict:
    if account.get("role") not in ("owner", "manager"):
        raise HTTPException(
            status_code=403,
            detail="Only managers can delete cases.",
        )
    result = await db["cases"].delete_one({"_id": case_id})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Case not found.")
    return {"id": case_id, "deleted": True}


@router.patch("/cases/{case_id}")
async def update_received_case(
    case_id: str,
    body: UpdateCase,
    account: dict = Depends(receiving_account),
) -> dict:
    existing = await db["cases"].find_one({"_id": case_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Case not found.")
    if existing.get("completionReviewStatus") == "pending":
        raise HTTPException(
            status_code=409,
            detail="This completion is awaiting Manager confirmation.",
        )
    if body.status == "removed" and existing.get("status") != "removed":
        raise HTTPException(
            status_code=422,
            detail="Only removed cases can keep the removed status.",
        )

    technician = None
    if body.technicianId:
        technician = await db[AUTH_USERS].find_one(
            {"_id": body.technicianId, "role": "technician"}
        )
        if not technician:
            technician = await db["users"].find_one(
                {"_id": body.technicianId, "role": "technician"}
            )
        if not technician:
            raise HTTPException(
                status_code=422, detail="Select a valid technician."
            )
        if body.status in ("production", "completed") and not technician.get(
            "active", True
        ):
            raise HTTPException(
                status_code=422,
                detail="Select an active technician for this case status.",
            )
    elif body.status in ("production", "completed"):
        raise HTTPException(
            status_code=422,
            detail="Select a responsible technician for this case status.",
        )

    if body.operationalAt is None:
        timestamp, local_date, local_time = _now()
    else:
        operational_at = body.operationalAt
        if operational_at.tzinfo is None:
            operational_at = operational_at.replace(tzinfo=ZoneInfo(TIMEZONE))
        else:
            operational_at = operational_at.astimezone(ZoneInfo(TIMEZONE))
        timestamp = (
            operational_at.astimezone(timezone.utc)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z")
        )
        local_date = operational_at.date()
        local_time = operational_at.strftime("%H:%M")
    display_name = account.get("name", account.get("email", "Receiving"))
    changes = {
        "department": body.department,
        "status": body.status,
        "technicianId": body.technicianId,
        "technician": technician.get("name", "") if technician else "",
        "updatedAt": timestamp,
    }
    if body.overdue is not None:
        changes["overdue"] = body.overdue
    if body.operationalAt is not None:
        if body.status == "queue":
            changes.update(
                receivedAt=timestamp,
                receivedDate=local_date.isoformat(),
                receivedTime=local_time,
            )
        elif body.status == "removed":
            changes["queueRemovedAt"] = timestamp
        elif body.status == "production":
            changes.update(
                startedAt=timestamp,
                startedDate=local_date.isoformat(),
                startedTime=local_time,
            )
        else:
            changes.update(
                finishedAt=timestamp,
                finishedDate=local_date.isoformat(),
                finishedTime=local_time,
            )
    if body.status == "production" and existing.get("status") != "production":
        changes.update(
            startedAt=timestamp,
            startedDate=local_date.isoformat(),
            startedTime=local_time,
            finishedAt="",
            finishedDate="",
            finishedTime="",
            finishedById="",
            finishedBy="",
            completionReviewRequired=False,
            completionReviewStatus="",
            managerConfirmedAt="",
            managerConfirmedById="",
            managerConfirmedBy="",
        )
    elif body.status == "completed":
        if not existing.get("startedAt"):
            changes.update(
                startedAt=timestamp,
                startedDate=local_date.isoformat(),
                startedTime=local_time,
            )
        if existing.get("status") != "completed" or not existing.get("finishedAt"):
            changes.update(
                finishedAt=timestamp,
                finishedDate=local_date.isoformat(),
                finishedTime=local_time,
            )
        changes.update(
            finishedById=body.technicianId,
            finishedBy=technician.get("name", ""),
            completionReviewRequired=False,
        )
    case = await db["cases"].find_one_and_update(
        {"_id": case_id},
        {
            "$set": changes,
            "$push": {
                "history": {
                    "at": timestamp,
                    "action": (
                        f"Receiving updated: {body.department}, "
                        f"{body.status.replace('_', ' ')}; technician "
                        f"{changes['technician'] or 'unassigned'}"
                    ),
                    "by": display_name,
                }
            },
        },
        return_document=ReturnDocument.AFTER,
    )
    if not case:
        raise HTTPException(
            status_code=409,
            detail="The case changed before it could be updated. Refresh and try again.",
        )
    return BaseDocument.from_mongo(case).to_api()


@router.patch("/cases/{case_id}/attention")
async def update_case_attention(
    case_id: str,
    body: UpdateAttention,
    account: dict = Depends(receiving_account),
) -> dict:
    existing = await db["cases"].find_one({"_id": case_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Case not found.")
    timestamp, _, _ = _now()
    display_name = account.get("name", account.get("email", "Receiving"))
    case = await db["cases"].find_one_and_update(
        {"_id": case_id},
        {
            "$set": {
                "attentionStatus": body.attentionStatus,
                "attentionNote": body.attentionNote,
                "updatedAt": timestamp,
            },
            "$push": {
                "history": {
                    "at": timestamp,
                    "action": (
                        f"Attention status changed to "
                        f"{body.attentionStatus.replace('_', ' ')}: "
                        f"{body.attentionNote}"
                        if body.attentionNote
                        else (
                            "Attention status changed to "
                            f"{body.attentionStatus.replace('_', ' ')}"
                        )
                    ),
                    "by": display_name,
                }
            },
        },
        return_document=ReturnDocument.AFTER,
    )
    if not case:
        raise HTTPException(
            status_code=409,
            detail="The case changed before its attention status could be updated.",
        )
    return BaseDocument.from_mongo(case).to_api()


@router.patch("/cases/{case_id}/overdue-reason")
async def update_case_overdue_reason(
    case_id: str,
    body: UpdateOverdueReason,
    account: dict = Depends(receiving_account),
) -> dict:
    existing = await db["cases"].find_one({"_id": case_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Case not found.")
    if existing.get("completionReviewStatus") == "pending":
        raise HTTPException(
            status_code=409,
            detail="This completion is awaiting Manager confirmation.",
        )

    timestamp, _, _ = _now()
    display_name = account.get("name", account.get("email", "Receiving"))
    case = await db["cases"].find_one_and_update(
        {"_id": case_id},
        {
            "$set": {
                "overdueReason": body.reason,
                "overdueReasonRequired": False,
                "updatedAt": timestamp,
            },
            "$push": {
                "history": {
                    "at": timestamp,
                    "action": "Overdue reason saved",
                    "by": display_name,
                }
            },
        },
        return_document=ReturnDocument.AFTER,
    )
    if not case:
        raise HTTPException(
            status_code=409,
            detail="The case changed before its overdue reason could be saved.",
        )
    return BaseDocument.from_mongo(case).to_api()
