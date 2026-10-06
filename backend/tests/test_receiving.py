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

    def __getitem__(self, name):
        assert name == "cases"
        return self.cases


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
