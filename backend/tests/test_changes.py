import asyncio

import pytest
import server
from core import changes
from core.security import current_account
from fastapi import Request, Response
from routers import changes as changes_router


class FakeChanges:
    def __init__(self):
        self.documents = {}

    async def update_one(self, query, update, upsert=False):
        document = self.documents.get(query["_id"])
        if document is None:
            assert upsert
            document = self.documents[query["_id"]] = {"_id": query["_id"]}
        for field, amount in update["$inc"].items():
            document[field] = document.get(field, 0) + amount

    async def find_one(self, query):
        return self.documents.get(query["_id"])


class FakeDatabase:
    def __init__(self):
        self.changes = FakeChanges()

    def __getitem__(self, name):
        assert name == "changes"
        return self.changes


@pytest.mark.parametrize(
    ("path", "area"),
    [
        ("/api/receiving/cases", "cases"),
        ("/api/receiving/cases/C1/attention", "cases"),
        ("/api/inbox/M1", "inbox"),
        ("/api/inbox/read-all", "inbox"),
        ("/api/products/import", "products"),
        ("/api/service-types/S1", "serviceTypes"),
        ("/api/routes/R1/stops/S1/check", "data"),
        ("/api/tooth-orders", "data"),
        ("/api/auth/technicians", "data"),
        ("/api/auth/login", None),
        ("/api/auth/logout", None),
        ("/api/auth/refresh", None),
        ("/health", None),
    ],
)
def test_writes_are_counted_in_the_area_they_change(path, area):
    assert changes.area_of_write(path) == area


def test_changes_count_up_per_area():
    database = FakeDatabase()
    assert asyncio.run(changes.read_changes(database)) == {
        area: 0 for area in changes.CHANGE_AREAS
    }

    asyncio.run(changes.record_change(database, "cases"))
    asyncio.run(changes.record_change(database, "cases"))
    asyncio.run(changes.record_change(database, "inbox"))

    assert asyncio.run(changes.read_changes(database)) == {
        "data": 0,
        "cases": 2,
        "inbox": 1,
        "products": 0,
        "serviceTypes": 0,
    }


def test_recording_a_change_never_fails_the_caller():
    class BrokenDatabase:
        def __getitem__(self, name):
            raise RuntimeError("database offline")

    asyncio.run(changes.record_change(BrokenDatabase(), "data"))


def test_changes_require_a_signed_in_account():
    dependencies = {d.dependency for d in changes_router.router.dependencies}
    assert current_account in dependencies
    routes = {
        (route.path, method)
        for route in server.app.routes
        for method in getattr(route, "methods", set())
    }
    assert ("/api/changes", "GET") in routes


def request(method, path):
    return Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": method,
            "scheme": "http",
            "path": path,
            "raw_path": path.encode(),
            "query_string": b"",
            "headers": [],
            "server": ("testserver", 80),
            "client": ("127.0.0.1", 1234),
        }
    )


@pytest.mark.parametrize(
    ("method", "path", "status_code", "recorded"),
    [
        ("POST", "/api/receiving/cases", 200, ["cases"]),
        ("PATCH", "/api/routes/R1/stops/S1/check", 200, ["data"]),
        ("DELETE", "/api/inbox/M1", 200, ["inbox"]),
        ("POST", "/api/receiving/cases", 422, []),
        ("GET", "/api/data", 200, []),
        ("POST", "/api/auth/refresh", 200, []),
    ],
)
def test_only_successful_writes_are_recorded(
    monkeypatch, method, path, status_code, recorded
):
    areas = []

    async def record_change(_database, area):
        areas.append(area)

    async def next_handler(_request):
        return Response(status_code=status_code)

    monkeypatch.setattr(server, "record_change", record_change)
    response = asyncio.run(
        server.record_successful_writes(request(method, path), next_handler)
    )

    assert response.status_code == status_code
    assert areas == recorded
