import asyncio

import pytest
from fastapi import HTTPException

from routers import logistics


class FakeCursor:
    def __init__(self, rows):
        self.rows = rows

    async def to_list(self, length=None):
        return self.rows


class FakeCollection:
    def __init__(self, rows):
        self.rows = rows
        self.deleted = []

    async def find_one(self, query):
        return next((r for r in self.rows if r["_id"] == query["_id"]), None)

    def find(self, query):
        if "clinicId" in query:
            return FakeCursor([r for r in self.rows if r.get("clinicId") == query["clinicId"]])
        ids = query["_id"]["$in"]
        closed = query["status"]["$nin"]
        return FakeCursor(
            [r for r in self.rows if r["_id"] in ids and r.get("status") not in closed]
        )

    async def delete_one(self, query):
        self.deleted.append(query["_id"])


class FakeDatabase:
    def __init__(self, stops, routes):
        self.collections = {
            "clinics": FakeCollection([{"_id": "C0001", "name": "Swords"}]),
            "stops": FakeCollection(stops),
            "routes": FakeCollection(routes),
            logistics.CLINIC_CONTACTS: FakeCollection([]),
        }

    def __getitem__(self, name):
        return self.collections[name]


def test_delete_clinic_removes_clinic_and_contacts(monkeypatch):
    db = FakeDatabase(
        [{"_id": "S1", "clinicId": "C0001", "routeId": "R1"}],
        [{"_id": "R1", "status": "completed"}],
    )
    monkeypatch.setattr(logistics, "db", db)

    result = asyncio.run(logistics.delete_clinic("C0001"))

    assert result == {"id": "C0001", "deleted": True}
    assert db["clinics"].deleted == ["C0001"]
    assert db[logistics.CLINIC_CONTACTS].deleted == ["C0001"]


def test_delete_clinic_is_blocked_by_open_routes(monkeypatch):
    db = FakeDatabase(
        [{"_id": "S1", "clinicId": "C0001", "routeId": "R1"}],
        [{"_id": "R1", "status": "published", "date": "2026-10-14"}],
    )
    monkeypatch.setattr(logistics, "db", db)

    with pytest.raises(HTTPException) as error:
        asyncio.run(logistics.delete_clinic("C0001"))

    assert error.value.status_code == 409
    assert error.value.detail["code"] == "clinic_has_routes"
    assert db["clinics"].deleted == []
