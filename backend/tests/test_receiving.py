import asyncio
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from routers import receiving
from routers.receiving import ReceiveCase


class FakeCases:
    def __init__(self, documents=None):
        self.documents = {
            document["_id"]: document for document in documents or []
        }

    async def find_one(self, query):
        return next(
            (
                document
                for document in self.documents.values()
                if all(
                    (
                        document.get(key) != value["$ne"]
                        if isinstance(value, dict) and "$ne" in value
                        else document.get(key) == value
                    )
                    for key, value in query.items()
                )
            ),
            None,
        )

    async def insert_one(self, document):
        self.documents[document["_id"]] = document

    async def update_many(self, query, update):
        modified_count = 0
        for document in self.documents.values():
            matches = True
            for key, value in query.items():
                current = document.get(key)
                if isinstance(value, dict) and "$ne" in value:
                    matches = matches and current != value["$ne"]
                elif isinstance(value, dict) and "$lte" in value:
                    matches = matches and current is not None and current <= value["$lte"]
                else:
                    matches = matches and current == value
            if not matches:
                continue
            for key, value in update.get("$set", {}).items():
                document[key] = value
            for key, value in update.get("$push", {}).items():
                document.setdefault(key, []).append(value)
            modified_count += 1
        return SimpleNamespace(modified_count=modified_count)

    async def find_one_and_update(self, query, update, return_document=None):
        document = await self.find_one(query)
        if not document:
            return None
        for key, value in update.get("$set", {}).items():
            document[key] = value
        for key in update.get("$unset", {}):
            document.pop(key, None)
        for key, value in update.get("$push", {}).items():
            document.setdefault(key, []).append(value)
        return document


class FakeDatabase:
    def __init__(self, cases):
        self.cases = cases
        self.users = cases.users
        self.auth_users = cases.auth_users

    def __getitem__(self, name):
        if name == "cases":
            return self.cases
        if name == "users":
            return self.users
        if name == "auth_users":
            return self.auth_users
        raise AssertionError(f"Unexpected collection: {name}")


def receive_payload(**overrides):
    payload = {
        "code": "RCV-1001",
        "department": "prosthesis",
        "productionDate": date(2026, 10, 7),
        "serviceTypes": ["Repair"],
        "arch": "Upper",
    }
    payload.update(overrides)
    return ReceiveCase(**payload)


@pytest.fixture
def receiving_db(monkeypatch):
    collection = FakeCases()
    collection.users = FakeCases()
    collection.auth_users = FakeCases()
    monkeypatch.setattr(receiving, "db", FakeDatabase(collection))
    monkeypatch.setattr(receiving, "_receiving_day", lambda: date(2026, 10, 6))
    monkeypatch.setattr(
        receiving,
        "_now",
        lambda: ("2026-10-06T12:00:00.000Z", date(2026, 10, 6), "13:00"),
    )
    return collection


def test_receive_creates_scheduled_case(receiving_db):
    result = asyncio.run(
        receiving.create_received_case(
            receive_payload(),
            {"_id": "MGR0001", "role": "manager", "name": "Manager"},
        )
    )

    assert result["code"] == "RCV-1001"
    assert result["status"] == "queue"
    assert result["department"] == "prosthesis"
    assert result["scheduledDate"] == "2026-10-07"
    assert result["serviceTypes"] == ["Repair"]
    assert result["history"][0]["by"] == "Manager"
    assert (
        receiving_db.documents[result["id"]]["currentDueDate"] == "2026-10-07"
    )


def test_receive_rejects_duplicate_case(receiving_db):
    asyncio.run(
        receiving.create_received_case(
            receive_payload(),
            {"_id": "MGR0001", "role": "manager", "name": "Manager"},
        )
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(
            receiving.create_received_case(
                receive_payload(),
                {"_id": "MGR0001", "role": "manager", "name": "Manager"},
            )
        )

    assert error.value.status_code == 409


def test_reenter_archives_old_cycle_and_resets_case(receiving_db):
    original = {
        "_id": "CASE-1",
        "code": "RCV-1001",
        "department": "prosthesis",
        "status": "completed",
        "scheduledDate": "2026-09-30",
        "originalScheduledDate": "2026-09-30",
        "currentDueDate": "2026-10-01",
        "overdue": True,
        "finishedAt": "2026-10-01T12:00:00Z",
        "serviceTypes": ["Try In"],
        "arch": "Lower",
        "history": [],
        "workSessions": [{"id": "work-1"}],
        "technicianId": "DT001",
        "finishedById": "DT001",
    }
    receiving_db.documents[original["_id"]] = original

    result = asyncio.run(
        receiving.create_received_case(
            receive_payload(caseId="CASE-1"),
            {"_id": "MGR0001", "role": "manager", "name": "Manager"},
        )
    )

    assert result["status"] == "queue"
    assert result["overdue"] is False
    assert result["scheduledDate"] == "2026-10-07"
    assert result["serviceTypes"] == ["Repair"]
    assert result["technicianId"] == ""
    assert result["reentryCycles"][0]["status"] == "completed"
    assert (
        result["reentryCycles"][0]["archivedAt"] == "2026-10-06T12:00:00.000Z"
    )


def test_restore_returns_removed_case_to_queue(receiving_db):
    receiving_db.documents["CASE-1"] = {
        "_id": "CASE-1",
        "code": "RCV-1001",
        "department": "digital",
        "status": "removed",
        "history": [],
    }

    result = asyncio.run(
        receiving.restore_received_case(
            "CASE-1", {"_id": "DT005", "role": "technician", "name": "Digital"}
        )
    )

    assert result["status"] == "queue"
    assert result["removedFromQueue"] is False
    assert result["queueRestoredBy"] == "Digital"
    assert result["history"][-1]["action"] == "Restored to queue"


def test_remove_received_case_from_active_queue_preserves_history(receiving_db):
    receiving_db.documents["CASE-1"] = {
        "_id": "CASE-1",
        "code": "RCV-1001",
        "status": "production",
        "history": [],
    }

    result = asyncio.run(
        receiving.remove_received_case(
            "CASE-1",
            {"_id": "DT005", "role": "technician", "name": "Technician"},
        )
    )

    assert result["status"] == "removed"
    assert result["removedFromQueue"] is True
    assert result["autoRemovedFromQueue"] is False
    assert result["previousQueueStatus"] == "queue"
    assert result["queueRemovedAt"] == "2026-10-06T12:00:00.000Z"
    assert result["queueRemovedBy"] == "Technician"
    assert result["history"][-1]["action"] == "Removed from queue"


def test_remove_received_case_rejects_completed_case(receiving_db):
    receiving_db.documents["CASE-1"] = {
        "_id": "CASE-1",
        "status": "completed",
        "history": [],
    }

    with pytest.raises(HTTPException) as error:
        asyncio.run(
            receiving.remove_received_case(
                "CASE-1",
                {"_id": "DT005", "role": "technician", "name": "Technician"},
            )
        )

    assert error.value.status_code == 409
    assert receiving_db.documents["CASE-1"]["status"] == "completed"


def test_auto_removed_case_cannot_be_restored_from_receiving(receiving_db):
    receiving_db.documents["CASE-1"] = {
        "_id": "CASE-1",
        "code": "RCV-1001",
        "department": "digital",
        "status": "removed",
        "autoRemovedFromQueue": True,
        "history": [],
    }

    with pytest.raises(HTTPException) as error:
        asyncio.run(
            receiving.restore_received_case(
                "CASE-1",
                {"_id": "DT005", "role": "technician", "name": "Digital"},
            )
        )

    assert error.value.status_code == 409
    assert receiving_db.documents["CASE-1"]["status"] == "removed"


def test_delete_received_case_preserves_history_and_records_actor(receiving_db):
    receiving_db.documents["CASE-1"] = {
        "_id": "CASE-1",
        "code": "RCV-1001",
        "status": "queue",
        "history": [],
    }

    result = asyncio.run(
        receiving.delete_received_case(
            "CASE-1",
            {"_id": "MGR0001", "role": "manager", "name": "Manager"},
        )
    )

    assert result == {"id": "CASE-1", "deleted": True}
    deleted = receiving_db.documents["CASE-1"]
    assert deleted["deleted"] is True
    assert deleted["deletedAt"] == "2026-10-06T12:00:00.000Z"
    assert deleted["deletedById"] == "MGR0001"
    assert deleted["history"][-1]["action"] == "Case deleted"
    assert deleted["history"][-1]["by"] == "Manager"


def test_technician_can_delete_received_case(receiving_db):
    receiving_db.documents["CASE-1"] = {
        "_id": "CASE-1",
        "code": "RCV-1001",
        "status": "queue",
        "history": [],
    }

    result = asyncio.run(
        receiving.delete_received_case(
            "CASE-1",
            {"_id": "DT005", "role": "technician", "name": "Technician"},
        )
    )

    assert result == {"id": "CASE-1", "deleted": True}
    deleted = receiving_db.documents["CASE-1"]
    assert deleted["deleted"] is True
    assert deleted["deletedById"] == "DT005"
    assert deleted["history"][-1]["by"] == "Technician"


def test_deleted_case_number_can_be_received_again(receiving_db):
    receiving_db.documents["CASE-1"] = {
        "_id": "CASE-1",
        "code": "RCV-1001",
        "deleted": True,
    }

    result = asyncio.run(
        receiving.create_received_case(
            receive_payload(),
            {"_id": "MGR0001", "role": "manager", "name": "Manager"},
        )
    )

    assert result["code"] == "RCV-1001"
    assert result["id"] != "CASE-1"


@pytest.mark.parametrize(
    "overrides",
    [
        {"serviceTypes": [], "arch": ""},
        {
            "serviceTypes": ["Invalid"],
            "arch": "Upper",
        },
        {"department": "digital", "serviceTypes": ["Repair"], "arch": ""},
        {"department": "ortho", "serviceTypes": [], "arch": ""},
    ],
)
def test_receive_rejects_invalid_work_details(overrides):
    with pytest.raises(ValidationError):
        receive_payload(**overrides)


def test_legacy_department_value_is_no_longer_accepted():
    with pytest.raises(ValidationError):
        receive_payload(department="denture")


@pytest.mark.parametrize("department", ["prosthesis", "ortho", "digital"])
def test_receive_accepts_work_details_for_every_department(department):
    payload = receive_payload(department=department)

    assert payload.serviceTypes == ["Repair"]
    assert payload.arch == "Upper"


@pytest.mark.parametrize("department", ["prosthesis", "ortho", "digital"])
def test_receive_saves_work_details_for_every_department(receiving_db, department):
    result = asyncio.run(
        receiving.create_received_case(
            receive_payload(department=department),
            {"_id": "MGR0001", "role": "manager", "name": "Manager"},
        )
    )

    assert result["serviceTypes"] == ["Repair"]
    assert result["arch"] == "Upper"


def test_technician_can_receive_cases_for_any_department(receiving_db):
    result = asyncio.run(
        receiving.create_received_case(
            receive_payload(department="prosthesis"),
            {"_id": "TEST-TECH-005", "role": "technician"},
        )
    )

    assert result["department"] == "prosthesis"
    assert result["status"] == "queue"


def test_update_case_assigns_department_status_and_technician(receiving_db):
    receiving_db.documents["CASE-1"] = {
        "_id": "CASE-1",
        "code": "RCV-1001",
        "department": "prosthesis",
        "status": "queue",
        "history": [],
    }
    receiving_db.auth_users.documents["DT001"] = {
        "_id": "DT001",
        "name": "Liam O'Connor",
        "role": "technician",
        "active": True,
    }

    result = asyncio.run(
        receiving.update_received_case(
            "CASE-1",
            receiving.UpdateCase(
                department="ortho", status="production", technicianId="DT001"
            ),
            {"_id": "MGR0001", "role": "manager", "name": "Manager"},
        )
    )

    assert result["department"] == "ortho"
    assert result["status"] == "production"
    assert result["technicianId"] == "DT001"
    assert result["technician"] == "Liam O'Connor"
    assert result["startedAt"] == "2026-10-06T12:00:00.000Z"
    assert result["history"][-1]["by"] == "Manager"


def test_update_case_saves_operational_time_and_overdue_status(receiving_db):
    receiving_db.documents["CASE-1"] = {
        "_id": "CASE-1",
        "code": "RCV-1001",
        "department": "prosthesis",
        "status": "queue",
        "history": [],
    }

    result = asyncio.run(
        receiving.update_received_case(
            "CASE-1",
            receiving.UpdateCase(
                department="digital",
                status="queue",
                operationalAt=datetime(2026, 10, 7, 14, 30),
                overdue=True,
            ),
            {"_id": "MGR0001", "role": "manager", "name": "Manager"},
        )
    )

    assert result["department"] == "digital"
    assert result["receivedAt"] == "2026-10-07T13:30:00.000Z"
    assert result["receivedDate"] == "2026-10-07"
    assert result["receivedTime"] == "14:30"
    assert result["overdue"] is True


def test_completing_case_records_finish_and_responsible_technician(receiving_db):
    receiving_db.documents["CASE-1"] = {
        "_id": "CASE-1",
        "department": "prosthesis",
        "status": "queue",
        "history": [],
    }
    receiving_db.auth_users.documents["DT001"] = {
        "_id": "DT001",
        "name": "Liam O'Connor",
        "role": "technician",
        "active": True,
    }

    result = asyncio.run(
        receiving.update_received_case(
            "CASE-1",
            receiving.UpdateCase(
                department="prosthesis", status="completed", technicianId="DT001"
            ),
            {"_id": "MGR0001", "role": "manager", "name": "Manager"},
        )
    )

    assert result["finishedAt"] == "2026-10-06T12:00:00.000Z"
    assert result["finishedById"] == "DT001"
    assert result["finishedBy"] == "Liam O'Connor"


def test_completed_cases_are_removed_after_ten_days(receiving_db):
    now = datetime(2026, 10, 16, 12, tzinfo=timezone.utc)
    cutoff = (now - timedelta(days=10)).isoformat(timespec="milliseconds").replace(
        "+00:00", "Z"
    )
    receiving_db.documents.update(
        {
            "EXPIRED": {
                "_id": "EXPIRED",
                "status": "completed",
                "finishedAt": cutoff,
                "history": [],
            },
            "RECENT": {
                "_id": "RECENT",
                "status": "completed",
                "finishedAt": "2026-10-06T12:00:00.001Z",
                "history": [],
            },
            "AWAITING_REVIEW": {
                "_id": "AWAITING_REVIEW",
                "status": "completed",
                "finishedAt": "2026-10-01T12:00:00.000Z",
                "completionReviewStatus": "pending",
                "history": [],
            },
            "DELETED": {
                "_id": "DELETED",
                "status": "completed",
                "finishedAt": "2026-10-01T12:00:00.000Z",
                "deleted": True,
                "history": [],
            },
            "IN_PRODUCTION": {
                "_id": "IN_PRODUCTION",
                "status": "production",
                "finishedAt": "2026-10-01T12:00:00.000Z",
                "history": [],
            },
        }
    )

    modified = asyncio.run(receiving.expire_completed_cases(now))

    expired = receiving_db.documents["EXPIRED"]
    assert modified == 1
    assert expired["status"] == "removed"
    assert expired["removedFromQueue"] is True
    assert expired["autoRemovedFromQueue"] is True
    assert expired["queueRemovedAt"] == "2026-10-16T12:00:00.000Z"
    assert expired["queueRemovedBy"] == "System"
    assert expired["previousQueueStatus"] == "completed"
    assert expired["history"][-1] == {
        "at": "2026-10-16T12:00:00.000Z",
        "action": "Automatically removed from queue after 10 days completed",
        "by": "System",
    }
    assert receiving_db.documents["RECENT"]["status"] == "completed"
    assert receiving_db.documents["AWAITING_REVIEW"]["status"] == "completed"
    assert receiving_db.documents["DELETED"]["status"] == "completed"
    assert receiving_db.documents["IN_PRODUCTION"]["status"] == "production"


def test_update_case_rejects_unknown_technician(receiving_db):
    receiving_db.documents["CASE-1"] = {
        "_id": "CASE-1",
        "department": "prosthesis",
        "status": "queue",
        "history": [],
    }

    with pytest.raises(HTTPException) as error:
        asyncio.run(
            receiving.update_received_case(
                "CASE-1",
                receiving.UpdateCase(
                    department="prosthesis",
                    status="production",
                    technicianId="UNKNOWN",
                ),
                {"_id": "MGR0001", "role": "manager", "name": "Manager"},
            )
        )

    assert error.value.status_code == 422


def test_technician_can_update_case_across_departments(receiving_db):
    receiving_db.documents["CASE-1"] = {
        "_id": "CASE-1",
        "department": "ortho",
        "status": "queue",
        "history": [],
    }

    result = asyncio.run(
        receiving.update_received_case(
            "CASE-1",
            receiving.UpdateCase(department="digital", status="queue"),
            {"_id": "DT005", "role": "technician"},
        )
    )

    assert result["department"] == "digital"
    assert result["status"] == "queue"


@pytest.mark.parametrize(
    "status, reason",
    [
        ("on_hold", "Waiting for clinic response"),
        ("need_information", "Need a new scan"),
        ("active", ""),
    ],
)
def test_update_attention_saves_status_and_optional_reason(
    receiving_db, status, reason
):
    receiving_db.documents["CASE-1"] = {
        "_id": "CASE-1",
        "department": "digital",
        "attentionStatus": "on_hold",
        "attentionNote": "Old reason",
        "history": [],
    }

    result = asyncio.run(
        receiving.update_case_attention(
            "CASE-1",
            receiving.UpdateAttention(
                attentionStatus=status,
                **({"attentionNote": reason} if reason else {}),
            ),
            {"_id": "MGR0001", "role": "manager", "name": "Manager"},
        )
    )

    assert result["attentionStatus"] == status
    assert result["attentionNote"] == reason
    if reason:
        assert reason in result["history"][-1]["action"]
    else:
        assert result["history"][-1]["action"] == "Attention status changed to active"


@pytest.mark.parametrize("reason", ["", " " * 4, "x" * 101])
def test_attention_requires_reason_for_non_active_status(reason):
    with pytest.raises(ValidationError):
        receiving.UpdateAttention(attentionStatus="on_hold", attentionNote=reason)


def test_attention_allows_optional_reason_for_active_status():
    result = receiving.UpdateAttention(attentionStatus="active")

    assert result.attentionNote == ""


def test_attention_active_reason_is_optional_but_limited_to_100_characters():
    result = receiving.UpdateAttention(
        attentionStatus="active", attentionNote="x" * 100
    )

    assert result.attentionNote == "x" * 100

    with pytest.raises(ValidationError):
        receiving.UpdateAttention(attentionStatus="active", attentionNote="x" * 101)


def test_update_case_overdue_reason_saves_trimmed_reason_and_clears_required_flag(
    receiving_db,
):
    receiving_db.documents["CASE-1"] = {
        "_id": "CASE-1",
        "code": "2532",
        "overdueReasonRequired": True,
        "history": [],
    }

    result = asyncio.run(
        receiving.update_case_overdue_reason(
            "CASE-1",
            receiving.UpdateOverdueReason(reason="  Waiting for materials  "),
            {"_id": "DT005", "role": "technician", "name": "Technician"},
        )
    )

    assert result["overdueReason"] == "Waiting for materials"
    assert result["overdueReasonRequired"] is False
    assert result["updatedAt"] == "2026-10-06T12:00:00.000Z"
    assert result["history"][-1] == {
        "at": "2026-10-06T12:00:00.000Z",
        "action": "Overdue reason saved",
        "by": "Technician",
    }


def test_update_case_overdue_reason_rejects_unknown_case(receiving_db):
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            receiving.update_case_overdue_reason(
                "UNKNOWN",
                receiving.UpdateOverdueReason(reason="Waiting for materials"),
                {"_id": "DT005", "role": "technician", "name": "Technician"},
            )
        )

    assert error.value.status_code == 404


@pytest.mark.parametrize("reason", ["", " " * 4, "x" * 101])
def test_overdue_reason_must_be_nonempty_and_limited_to_100_characters(reason):
    with pytest.raises(ValidationError):
        receiving.UpdateOverdueReason(reason=reason)
