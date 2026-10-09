import asyncio
from datetime import date
from types import SimpleNamespace

from routers import logistics
from routers.logistics import DeliveryInput, RouteCreate


class FakeCollection:
    def __init__(self, name, route):
        self.name = name
        self.route = route

    async def find_one(self, query):
        if self.name == "cases":
            assert query["_id"] == "case-1"
            assert query["code"] == "RCV-1001"
            assert query["status"] == {"$in": ["queue", "production", "completed"]}
            assert query["managerConfirmedAt"] == {"$in": [None, ""]}
            return {
                "_id": "case-1",
                "code": "RCV-1001",
                "status": "production",
                "managerConfirmedAt": "",
            }
        if self.name == "stops":
            return None
        if self.name == "route_plans":
            return None
        if self.name == "routes":
            return self.route
        raise AssertionError(f"Unexpected collection: {self.name}")


class FakeDatabase:
    def __init__(self, route):
        self.collections = {
            name: FakeCollection(name, route)
            for name in ("cases", "stops", "route_plans", "routes")
        }

    def __getitem__(self, name):
        return self.collections[name]


def test_route_accepts_active_case_with_non_numeric_case_code(monkeypatch):
    route = {"_id": "R1", "status": "published"}

    async def active_driver(_driver_id):
        return {"_id": "D1"}

    async def require_clinic(_clinic_id):
        return {"_id": "C1"}

    async def get_or_create_route(_date, _driver, _creator):
        return route

    async def add_stop(_route, _clinic, _deliveries, _collections):
        return {}

    monkeypatch.setattr(logistics, "db", FakeDatabase(route))
    monkeypatch.setattr(logistics, "active_driver", active_driver)
    monkeypatch.setattr(logistics, "require_clinic", require_clinic)
    monkeypatch.setattr(logistics, "get_or_create_route", get_or_create_route)
    monkeypatch.setattr(logistics, "add_stop", add_stop)
    monkeypatch.setattr(
        logistics.BaseDocument,
        "from_mongo",
        lambda document: SimpleNamespace(to_api=lambda: document),
    )
    body = RouteCreate(
        date=date(2026, 10, 8),
        driverId="D1",
        deliveries=[
            DeliveryInput(
                clinicId="C1",
                caseNumber="RCV-1001",
                productionCaseId="case-1",
                productionConfirmedAt="",
            )
        ],
    )

    result = asyncio.run(logistics.create_route(body, {"_id": "manager-1"}))

    assert result == route


def test_tracking_record_uses_mongo_document_ids():
    route = {
        "_id": "R20261008-001",
        "date": "2026-10-08",
        "status": "published",
        "stopIds": ["R20261008-001-S001"],
        "trackingTokens": {"R20261008-001-S001": "a" * 48},
        "updatedAt": "2026-10-08T12:00:00+00:00",
    }
    stop = {
        "_id": "R20261008-001-S001",
        "deliveries": [{"caseNumber": "1001"}],
        "collections": [],
    }

    record = logistics.tracking_record(route, stop, {"name": "Clinic"})

    assert record["_id"] == "a" * 48
    assert record["routeId"] == route["_id"]
    assert record["stopId"] == stop["_id"]
    assert record["stopsRemaining"] == 0
