import asyncio
from datetime import date
from types import SimpleNamespace

from routers import logistics
from routers.logistics import DeliveryInput, RouteCreate, StopTransfer


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


def test_route_creates_separate_stops_for_delivery_and_collection_at_same_clinic(
    monkeypatch,
):
    route = {"_id": "R1", "status": "published", "stopIds": []}
    stop_calls = []

    class FakeCollection:
        def __init__(self, name):
            self.name = name

        async def find_one(self, _query):
            if self.name == "routes":
                return route
            return None

    class FakeDatabase:
        def __getitem__(self, name):
            if name in ("route_plans", "routes"):
                return FakeCollection(name)
            raise AssertionError(f"Unexpected collection: {name}")

    async def active_driver(_driver_id):
        return {"_id": "D1"}

    async def require_clinic(_clinic_id):
        return {"_id": "C1"}

    async def get_or_create_route(_date, _driver, _creator):
        return route

    async def add_stop(_route, clinic, deliveries, collections):
        stop_calls.append((clinic["_id"], deliveries, collections))
        stop = {"_id": f"S{len(stop_calls)}"}
        route["stopIds"].append(stop["_id"])
        return stop

    monkeypatch.setattr(logistics, "db", FakeDatabase())
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
        deliveries=[DeliveryInput(clinicId="C1", caseNumber="6366")],
        collections=[{"clinicId": "C1", "notes": ""}],
    )

    result = asyncio.run(logistics.create_route(body, {"_id": "manager-1"}))

    assert result == route
    assert stop_calls == [
        ("C1", [{"caseNumber": "6366"}], []),
        ("C1", [], [{"notes": ""}]),
    ]


def test_transfer_route_stop_uses_requested_date_for_same_driver(monkeypatch):
    route_date = "2026-10-12"
    source = {
        "_id": "R20261008-001",
        "date": "2026-10-08",
        "driverId": "D1",
    }
    stop = {
        "_id": "R20261008-001-S001",
        "routeId": source["_id"],
        "status": "pending",
    }

    class FakeCollection:
        def __init__(self, name):
            self.name = name

        async def find_one(self, query):
            if self.name == "routes":
                return source
            if self.name == "stops":
                return stop
            raise AssertionError(f"Unexpected collection: {self.name}")

    class FakeDatabase:
        def __getitem__(self, name):
            return FakeCollection(name)

    async def active_driver(_driver_id):
        return {"_id": "D1"}

    async def get_or_create_route(requested_date, _driver, _creator):
        assert requested_date == route_date
        raise RuntimeError("Stop after verifying the selected destination date")

    monkeypatch.setattr(logistics, "db", FakeDatabase())
    monkeypatch.setattr(logistics, "active_driver", active_driver)
    monkeypatch.setattr(logistics, "get_or_create_route", get_or_create_route)

    try:
        asyncio.run(
            logistics.transfer_route_stop(
                source["_id"],
                stop["_id"],
                StopTransfer(driverId="D1", routeDate=date.fromisoformat(route_date)),
                {"_id": "manager-1"},
            )
        )
    except RuntimeError as error:
        assert str(error) == "Stop after verifying the selected destination date"
    else:
        raise AssertionError("Expected the route lookup to stop the test")


def test_delete_route_stop_removes_stop_and_related_notifications(monkeypatch):
    stop_id = "R20261008-001-S001"
    route = {
        "_id": "R20261008-001",
        "status": "published",
        "stopIds": [stop_id, "R20261008-001-S002"],
    }
    stop = {"_id": stop_id, "routeId": route["_id"], "status": "pending"}
    calls = []

    class FakeCollection:
        def __init__(self, name):
            self.name = name

        async def find_one(self, query):
            if self.name == "routes":
                return route
            if self.name == "stops":
                assert query == {"_id": stop_id, "routeId": route["_id"]}
                return stop
            raise AssertionError(f"Unexpected find_one on {self.name}")

        async def update_one(self, query, update):
            calls.append((self.name, "update_one", query, update))

        async def update_many(self, query, update):
            calls.append((self.name, "update_many", query, update))

        async def delete_one(self, query):
            calls.append((self.name, "delete_one", query))

        async def delete_many(self, query):
            calls.append((self.name, "delete_many", query))

    class FakeDatabase:
        def __getitem__(self, name):
            return FakeCollection(name)

    monkeypatch.setattr(logistics, "db", FakeDatabase())
    monkeypatch.setattr(logistics, "now_iso", lambda: "2026-10-08T12:00:00+00:00")

    result = asyncio.run(logistics.delete_route_stop(route["_id"], stop_id))

    assert result == {"id": stop_id, "routeId": route["_id"], "deleted": True}
    assert route["stopIds"] == ["R20261008-001-S002"]
    assert route["totalStops"] == 1
    assert ("stops", "delete_one", {"_id": stop_id, "routeId": route["_id"]}) in calls
    assert not any(name in ("public_tracking", "tracking_emails") for name, *_ in calls)
    assert (
        "notifications",
        "delete_many",
        {"routeId": route["_id"], "stopId": stop_id},
    ) in calls
    assert ("route_plans", "delete_many", {"_id": route["_id"]}) in calls


def test_get_or_create_route_creates_route_for_requested_driver_and_date(monkeypatch):
    requested_date = "2026-10-12"
    created = {"_id": "R20261012-001"}
    requested = {}

    class FakeRoutes:
        async def find_one(self, _query):
            return None

    class FakeDatabase:
        def __getitem__(self, name):
            assert name == "routes"
            return FakeRoutes()

    async def new_route(route_date, driver, creator):
        requested.update(date=route_date, driver=driver, creator=creator)
        return created

    driver = {"_id": "D1"}
    creator = {"_id": "manager-1"}
    monkeypatch.setattr(logistics, "db", FakeDatabase())
    monkeypatch.setattr(logistics, "new_route", new_route)

    result = asyncio.run(logistics.get_or_create_route(requested_date, driver, creator))

    assert result is created
    assert requested == {
        "date": requested_date,
        "driver": driver,
        "creator": creator,
    }
