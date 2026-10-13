import asyncio
import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo

from bson import ObjectId
from core.case_history import log_case_event
from core.collections import AUTH_USERS, CASE_HISTORY
from core.config import TIMEZONE
from core.database import db
from core.inbox import notify_managers
from core.models import BaseDocument
from core.production_calendar import is_production_day
from core.workflow_constants import ARCH_OPTIONS, SERVICE_TYPES
from core.security import current_account, require_roles
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
    dueTime: time
    serviceTypes: list[str] = Field(
        default_factory=list, max_length=len(SERVICE_TYPES)
    )
    arch: str = ""
    caseId: str | None = Field(default=None, min_length=1, max_length=100)

    @model_validator(mode="after")
    def validate_work_details(self):
        self.dueTime = self.dueTime.replace(second=0, microsecond=0, tzinfo=None)
        if any(item not in SERVICE_TYPES for item in self.serviceTypes) or (
            "None" in self.serviceTypes and len(self.serviceTypes) > 1
        ):
            raise ValueError("Select valid service types.")
        if not self.serviceTypes or self.arch not in ARCH_OPTIONS:
            raise ValueError(
                "Select at least one service type and a valid arch."
            )
        return self


MAX_IMPORT_CASES = 5000
LEGACY_DEPARTMENTS = {"denture": "prosthesis"}


class ImportHistoryEntry(BaseModel):
    at: str = Field(default="", max_length=40)
    action: str = Field(min_length=1, max_length=300)
    by: str = Field(default="", max_length=100)


class ImportCase(BaseModel):
    code: str = Field(
        min_length=1, max_length=64, pattern=r"^[A-Za-z0-9._/-]+$"
    )
    department: Literal["prosthesis", "ortho", "digital"]
    currentDueDate: date | None = None
    productionDate: date | None = None
    scheduledDate: date | None = None
    originalScheduledDate: date | None = None
    status: Literal["queue", "completed"] = "queue"
    serviceTypes: list[str] = Field(
        default_factory=list, max_length=len(SERVICE_TYPES)
    )
    arch: str = ""
    attentionStatus: Literal["active", "on_hold", "need_information"] = "active"
    attentionNote: str = Field(default="", max_length=100)
    receivedAt: datetime | None = None
    createdAt: datetime | None = None
    updatedAt: datetime | None = None
    missedScheduleDates: dict[date, bool] = Field(
        default_factory=dict, max_length=366
    )
    history: list[ImportHistoryEntry] | dict[str, ImportHistoryEntry] = Field(
        default_factory=list, max_length=200
    )

    @model_validator(mode="before")
    @classmethod
    def map_legacy_department(cls, data):
        if isinstance(data, dict):
            department = str(data.get("department", "")).strip().lower()
            status_value = str(data.get("status", "")).strip().lower()
            data = {
                **data,
                "department": LEGACY_DEPARTMENTS.get(department, department),
                "status": "completed" if status_value == "completed" else "queue",
            }
        return data

    @model_validator(mode="after")
    def validate_import(self):
        if any(item not in SERVICE_TYPES for item in self.serviceTypes) or (
            "None" in self.serviceTypes and len(self.serviceTypes) > 1
        ):
            raise ValueError("Select valid service types.")
        if not self.serviceTypes or self.arch not in ARCH_OPTIONS:
            raise ValueError(
                "Select at least one service type and a valid arch."
            )
        if not (self.currentDueDate or self.productionDate):
            raise ValueError("currentDueDate is required.")
        return self


class ImportCases(BaseModel):
    cases: list[ImportCase] = Field(min_length=1, max_length=MAX_IMPORT_CASES)


class UpdateCase(BaseModel):
    department: Literal["prosthesis", "ortho", "digital"]
    status: Literal["queue", "production", "completed", "removed"]
    technicianId: str = Field(default="", max_length=100)
    operationalAt: datetime | None = None
    overdue: bool | None = None
    deliveryStatus: Literal[
        "not_delivered", "out_for_delivery", "delivered"
    ] | None = None
    dueDate: date | None = None
    dueTime: time | None = None

    @model_validator(mode="after")
    def normalise_due_time(self):
        if self.dueTime is not None:
            self.dueTime = self.dueTime.replace(
                second=0, microsecond=0, tzinfo=None
            )
        return self


ATTENTION_LABELS = {"on_hold": "On Hold", "need_information": "Need Information"}


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


def _receiving_time() -> time:
    return datetime.now(ZoneInfo(TIMEZONE)).time().replace(tzinfo=None)


def _due_time(body: ReceiveCase) -> str:
    return body.dueTime.strftime("%H:%M") if body.dueTime else ""


def _due_label(body: ReceiveCase) -> str:
    return f"{body.productionDate.isoformat()} {_due_time(body)}".strip()


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
    expiry_query = {
        "status": "completed",
        "finishedAt": {"$lte": cutoff},
        "deleted": {"$ne": True},
        "completionReviewStatus": {"$ne": "pending"},
    }
    expiring = await db["cases"].find(expiry_query).to_list(None)
    result = await db["cases"].update_many(
        expiry_query,
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
    for expired in expiring:
        await log_case_event(
            db,
            expired,
            "Automatically removed from queue after 10 days completed",
            None,
            timestamp,
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


async def _log(
    case: dict, action: str, account: dict | None, at: str | None = None
) -> None:
    await log_case_event(db, case, action, account, at)


async def receiving_account(account: dict = Depends(current_account)) -> dict:
    if account.get("role") in ("owner", "manager", "technician"):
        return account
    raise HTTPException(status_code=403, detail="Insufficient permissions.")


def _validate_production_date(production_date: date, due_time: time) -> None:
    if production_date < _receiving_day():
        raise HTTPException(
            status_code=422, detail="Production date cannot be in the past."
        )
    if production_date == _receiving_day() and due_time <= _receiving_time():
        raise HTTPException(
            status_code=422, detail="Due time cannot be in the past."
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
        "currentDueTime": _due_time(body),
        "missedScheduleDates": {},
        "receivedDate": received_date.isoformat(),
        "receivedAt": timestamp,
        "receivedTime": received_time,
        "serviceTypes": body.serviceTypes,
        "arch": body.arch,
        "attentionStatus": "active",
        "attentionNote": "",
        "deliveryStatus": "not_delivered",
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
                    f"{_due_label(body)}"
                ),
                "by": display_name,
            }
        ],
    }


async def _create_or_reenter(body: ReceiveCase, account: dict) -> dict:
    _validate_production_date(body.productionDate, body.dueTime)

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
                "currentDueTime",
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
                "currentDueTime": _due_time(body),
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
                        f"Re-entered for {_due_label(body)}; "
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
        await _log(
            case,
            f"Re-entered for {_due_label(body)} "
            f"({body.department}, {', '.join(body.serviceTypes)}, "
            f"{body.arch}); previous cycle archived",
            account,
            timestamp,
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
    await _log(
        case,
        f"Received and scheduled for {_due_label(body)} "
        f"({body.department}, {', '.join(body.serviceTypes)}, {body.arch})",
        account,
        case["receivedAt"],
    )
    return BaseDocument.from_mongo(case).to_api()


@router.post("/cases", status_code=status.HTTP_201_CREATED)
async def create_received_case(
    body: ReceiveCase, account: dict = Depends(receiving_account)
) -> dict:
    return await _create_or_reenter(body, account)


def _iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return (
        value.astimezone(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _imported_case(item: ImportCase, account: dict) -> dict:
    now, _, _ = _now()
    due = (item.currentDueDate or item.productionDate).isoformat()
    scheduled = (item.scheduledDate or item.currentDueDate or item.productionDate).isoformat()
    original = (item.originalScheduledDate or item.scheduledDate or item.currentDueDate or item.productionDate).isoformat()
    received = _iso(item.receivedAt or item.createdAt) if (item.receivedAt or item.createdAt) else now
    local_received = datetime.fromisoformat(received.replace("Z", "+00:00")).astimezone(ZoneInfo(TIMEZONE))
    entries = (
        list(item.history.values())
        if isinstance(item.history, dict)
        else item.history
    )
    entries = sorted(entries, key=lambda entry: entry.at)
    history = [entry.model_dump() for entry in entries]
    history.append(
        {
            "at": now,
            "action": "Imported from previous system",
            "by": account.get("name", account.get("email", "Import")),
        }
    )
    case = _new_case(
        ReceiveCase.model_construct(
            code=item.code,
            department=item.department,
            productionDate=item.productionDate or item.currentDueDate,
            dueTime=None,
            serviceTypes=item.serviceTypes,
            arch=item.arch,
            caseId=None,
        ),
        account,
    )
    case.update(
        {
            "status": item.status,
            "scheduledDate": scheduled,
            "originalScheduledDate": original,
            "currentDueDate": due,
            "missedScheduleDates": {
                key.isoformat(): True for key in item.missedScheduleDates
            },
            "receivedDate": local_received.date().isoformat(),
            "receivedAt": received,
            "receivedTime": local_received.strftime("%H:%M"),
            "attentionStatus": item.attentionStatus,
            "attentionNote": item.attentionNote,
            "createdAt": _iso(item.createdAt) if item.createdAt else received,
            "updatedAt": _iso(item.updatedAt) if item.updatedAt else now,
            "history": history,
        }
    )
    return case


@router.post("/cases/import", status_code=status.HTTP_201_CREATED)
async def import_cases(
    body: ImportCases,
    account: dict = Depends(require_roles("owner", "manager")),
) -> dict:
    errors = []
    seen = set()
    for index, item in enumerate(body.cases, start=2):
        key = item.code.lower()
        if key in seen or await db["cases"].find_one(
            {"code": item.code, "deleted": {"$ne": True}}
        ):
            errors.append(f"Row {index}: Case {item.code} already exists.")
        seen.add(key)
    if errors:
        raise HTTPException(status_code=422, detail=" ".join(errors[:10]))

    imported = []
    for item in body.cases:
        case = _imported_case(item, account)
        await db["cases"].insert_one(case)
        await _log(
            case,
            f"Imported with status {item.status}, due {case['currentDueDate']} "
            f"({item.department}, {', '.join(item.serviceTypes)}, {item.arch})",
            account,
        )
        imported.append(BaseDocument.from_mongo(case).to_api())
    return {"cases": imported}


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
    await _log(case, "Restored to queue", account, timestamp)
    return BaseDocument.from_mongo(case).to_api()


@router.post("/cases/{case_id}/remove")
async def remove_received_case(
    case_id: str, account: dict = Depends(receiving_account)
) -> dict:
    existing = await db["cases"].find_one({"_id": case_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Case not found.")
    if existing.get("completionReviewStatus") == "pending":
        raise HTTPException(
            status_code=409,
            detail="This completion is awaiting Manager confirmation.",
        )
    if existing.get("status") not in ("queue", "production", "completed"):
        raise HTTPException(
            status_code=409,
            detail="Only queue, production or completed cases can be removed.",
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
                "previousQueueStatus": existing["status"],
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
    await _log(
        case,
        f"Removed from queue (was {existing['status']})",
        account,
        timestamp,
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
    existing = await db["cases"].find_one({"_id": case_id})
    result = await db["cases"].delete_one({"_id": case_id})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Case not found.")
    await _log(
        existing or {"_id": case_id},
        "Case deleted",
        account,
    )
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

    old_due_date = existing.get("currentDueDate") or existing.get("scheduledDate") or ""
    old_due_time = existing.get("currentDueTime") or ""
    new_due_date = body.dueDate.isoformat() if body.dueDate else old_due_date
    new_due_time = (
        body.dueTime.strftime("%H:%M") if body.dueTime else old_due_time
    )
    rescheduled = (new_due_date, new_due_time) != (old_due_date, old_due_time)
    if rescheduled:
        if not new_due_date or not new_due_time:
            raise HTTPException(
                status_code=422,
                detail="Choose both a due date and a due time.",
            )
        _validate_production_date(
            date.fromisoformat(new_due_date),
            time.fromisoformat(new_due_time),
        )
    old_due_label = f"{old_due_date} {old_due_time}".strip() or "not set"
    new_due_label = f"{new_due_date} {new_due_time}".strip()

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
    if body.deliveryStatus is not None:
        changes["deliveryStatus"] = body.deliveryStatus
    if rescheduled:
        # originalScheduledDate stays untouched so overdue days still count
        # from the first promised date.
        changes.update(
            scheduledDate=new_due_date,
            currentDueDate=new_due_date,
            currentDueTime=new_due_time,
        )
        if not existing.get("originalScheduledDate") and old_due_date:
            changes["originalScheduledDate"] = old_due_date
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
    previous_technician = existing.get("technician") or "unassigned"
    new_technician = changes["technician"] or "unassigned"
    differences = []
    for label, old, new in (
        ("department", existing.get("department"), body.department),
        ("status", existing.get("status"), body.status),
        ("technician", previous_technician, new_technician),
        (
            "delivery status",
            existing.get("deliveryStatus", "not_delivered"),
            body.deliveryStatus,
        ),
        (
            "overdue",
            bool(existing.get("overdue")),
            body.overdue if body.overdue is not None else None,
        ),
    ):
        if new is not None and old != new:
            differences.append(
                f"{label} {str(old).replace('_', ' ')} -> "
                f"{str(new).replace('_', ' ')}"
            )
    if rescheduled:
        differences.append(
            f"scheduled due date {old_due_label} -> {new_due_label}"
        )
    if body.operationalAt is not None:
        differences.append(f"operational time set to {timestamp}")
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
                        + (
                            f"; rescheduled from {old_due_label} "
                            f"to {new_due_label}"
                            if rescheduled
                            else ""
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
            detail="The case changed before it could be updated. Refresh and try again.",
        )
    await _log(
        case,
        "Case updated by manager: "
        + ("; ".join(differences) if differences else "no field changed"),
        account,
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
    await _log(
        case,
        f"Attention status changed to {body.attentionStatus.replace('_', ' ')}"
        + (f": {body.attentionNote}" if body.attentionNote else ""),
        account,
        timestamp,
    )
    if (
        body.attentionStatus != "active"
        and existing.get("attentionStatus") != body.attentionStatus
    ):
        label = ATTENTION_LABELS[body.attentionStatus]
        await notify_managers(
            db,
            kind="case_attention",
            title=f"Case {case.get('code', case_id)} set to {label}",
            body=body.attentionNote,
            target="case",
            target_id=case_id,
            actor=account,
            severity="warning",
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
    await _log(
        case, f"Overdue reason saved: {body.reason}", account, timestamp
    )
    return BaseDocument.from_mongo(case).to_api()


@router.get("/cases/{case_id}/history")
async def read_case_history(
    case_id: str, account: dict = Depends(receiving_account)
) -> dict:
    logged = (
        await db[CASE_HISTORY].find({"caseId": case_id}).to_list(None)
    )
    case = await db["cases"].find_one({"_id": case_id})
    if not case and not logged:
        raise HTTPException(status_code=404, detail="Case not found.")
    entries = [
        {"at": e["at"], "action": e["action"], "by": e["by"]} for e in logged
    ]
    first_logged = min((e["at"] for e in logged), default=None)
    # Entries written before the audit log existed live on the case itself.
    for legacy in (case or {}).get("history", []):
        at = legacy.get("at") or ""
        if first_logged is None or at < first_logged:
            entries.append(
                {
                    "at": at,
                    "action": legacy.get("action") or "",
                    "by": legacy.get("by") or "",
                }
            )
    entries.sort(key=lambda e: e["at"])
    return {
        "caseId": case_id,
        "code": (case or {}).get("code")
        or next((e.get("caseCode") for e in logged), ""),
        "history": entries,
    }
