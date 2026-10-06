import asyncio
import random
from datetime import date

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from routers import receiving
from routers.receiving import ReceiveCase
from seed.production import build_cases
from seed.reference import STAFF


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
        {"department": "denture", "serviceTypes": [], "arch": ""},
        {
            "department": "denture",
            "serviceTypes": ["Invalid"],
            "arch": "Upper",
        },
        {"department": "digital", "serviceTypes": ["Repair"], "arch": ""},
        {"department": "ortho", "productionDate": date(2026, 10, 10)},
    ],
)
def test_receive_rejects_invalid_work_details(overrides):
    with pytest.raises(ValidationError):
        receive_payload(**overrides)


def test_legacy_department_value_is_no_longer_accepted():
    with pytest.raises(ValidationError):
        receive_payload(department="denture")


def test_seeded_staff_and_cases_use_prosthesis_department():
    cases = build_cases(date(2026, 10, 6), random.Random(2026)).items

    assert any(case["department"] == "prosthesis" for case in cases)
    assert all(person[3] != "denture" for person in STAFF)
    assert all(case["department"] != "denture" for case in cases)


def test_digital_receiving_cannot_create_cases_for_other_departments(
    receiving_db,
):
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            receiving.create_received_case(
                receive_payload(),
                {
                    "_id": "DT005",
                    "role": "technician",
                    "department": "digital",
                },
            )
        )

    assert error.value.status_code == 403


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


def test_digital_receiving_cannot_update_another_department(receiving_db):
    receiving_db.documents["CASE-1"] = {
        "_id": "CASE-1",
        "department": "ortho",
        "status": "queue",
        "history": [],
    }

    with pytest.raises(HTTPException) as error:
        asyncio.run(
            receiving.update_received_case(
                "CASE-1",
                receiving.UpdateCase(department="digital", status="queue"),
                {
                    "_id": "DT005",
                    "role": "technician",
                    "department": "digital",
                },
            )
        )

    assert error.value.status_code == 403


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
