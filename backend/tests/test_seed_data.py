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


def test_demo_seed_has_100_cases_covering_all_workflow_statuses():
    data = build_demo_data(date(2026, 10, 7))

    assert "tooth_orders" in loader.PERSISTENT_COLLECTIONS
    assert len(data["cases"]) == 100
    assert {case["status"] for case in data["cases"]} == {
        "queue",
        "production",
        "completed",
        "removed",
    }
    assert {case["department"] for case in data["cases"]} == {
        "prosthesis",
        "ortho",
        "digital",
    }
    assert {
        case["attentionStatus"] for case in data["cases"]
    } == {"active", "on_hold", "need_information"}
    generated = [case for case in data["cases"] if int(case["code"]) >= 7001]
    assert {
        (
            case["department"],
            case["status"],
            case["attentionStatus"],
            case["overdue"],
        )
        for case in generated
    } == {
        (department, status, attention, overdue)
        for department in ("prosthesis", "ortho", "digital")
        for status in ("queue", "production", "completed", "removed")
        for attention in ("active", "on_hold", "need_information")
        for overdue in (False, True)
    }
    assert any(case["completionReviewStatus"] == "pending" for case in data["cases"])
    assert any(case["completionReviewStatus"] == "confirmed" for case in data["cases"])
    assert any(case["overdue"] for case in data["cases"])
    assert any(case["serviceTypes"] for case in data["cases"])
    assert any(case["arch"] for case in data["cases"])
    assert any(
        case.get("managerConfirmedAt", "") < "2026-09-27"
        for case in data["cases"]
    )
    assert "leave_requests" not in data
    for collection in (
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

    assert all(
        case["technicianId"].startswith("DEMO-TECH-")
        for case in data["cases"]
        if case["status"] in ("production", "completed")
    )


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
