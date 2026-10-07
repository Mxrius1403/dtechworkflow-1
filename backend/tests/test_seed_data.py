import asyncio
from datetime import date

from core.collections import PUBLIC_TRACKING
from seed import loader
from seed.loader import build_demo_data


class FakeCursor:
    def __init__(self, rows):
        self.rows = rows

    async def to_list(self, _):
        return self.rows


class FakeCollection:
    def __init__(self, rows=()):
        self.rows = list(rows)
        self.find_query = None
        self.delete_queries = []

    def find(self, query):
        self.find_query = query
        return FakeCursor(self.rows)

    async def delete_many(self, query):
        self.delete_queries.append(query)


class FakeDatabase(dict):
    def __getitem__(self, name):
        return self.setdefault(name, FakeCollection())


def test_demo_seed_excludes_technicians_and_their_records():
    data = build_demo_data(date(2026, 10, 7))

    assert "tooth_orders" in loader.PERSISTENT_COLLECTIONS
    assert all(user["role"] != "technician" for user in data["users"])
    for collection in (
        "leave_requests",
        "other_work",
        "tooth_orders",
        "material_orders",
        "routes",
        "stops",
        "route_plans",
        "tracking_emails",
        "notifications",
        PUBLIC_TRACKING,
    ):
        assert data[collection] == []

    assert all(not case["technicianId"] for case in data["cases"])
    assert all(not case["workSessions"] for case in data["cases"])


def test_legacy_route_cleanup_targets_seed_cases(monkeypatch):
    database = FakeDatabase()
    database["cases"] = FakeCollection([{"_id": "CASE011-4111", "code": "4111"}])
    database["stops"] = FakeCollection([{"routeId": "R20261007-001"}])
    monkeypatch.setattr(loader, "db", database)

    asyncio.run(loader.remove_legacy_technician_routes())

    assert database["cases"].find_query["_id"] == {"$regex": "^CASE"}
    assert database["stops"].find_query == {
        "deliveries.productionCaseId": {"$in": ["CASE011-4111"]}
    }
    assert database["routes"].delete_queries == [
        {"_id": {"$in": ["R20261007-001"]}}
    ]
    for name in (
        "stops",
        "route_plans",
        "tracking_emails",
        "notifications",
        PUBLIC_TRACKING,
    ):
        assert database[name].delete_queries == [
            {"routeId": {"$in": ["R20261007-001"]}}
        ]
