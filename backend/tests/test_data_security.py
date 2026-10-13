import asyncio

import pytest
from fastapi import HTTPException
from routers import data


@pytest.mark.parametrize("role", ["technician", "driver"])
def test_all_data_omits_reports_for_non_managers(monkeypatch, role):
    async def no_op():
        return None

    async def read_collection(collection, include_login_email=False, query=None):
        return [{"collection": collection}] if collection == "saved_reports" else []

    async def read_suppliers(include_contact=False):
        return []

    async def read_settings():
        return {}

    monkeypatch.setattr(data, "archive_stale_routes", no_op)
    monkeypatch.setattr(data, "read_collection", read_collection)
    monkeypatch.setattr(data, "read_suppliers", read_suppliers)
    monkeypatch.setattr(data, "read_settings", read_settings)

    payload = asyncio.run(data.all_data({"role": role, "_id": "account-1"}))

    assert "reports" not in payload


@pytest.mark.parametrize("role", ["owner", "manager"])
def test_all_data_includes_reports_for_managers(monkeypatch, role):
    supplier_rows = [{
        "id": "supplier-1",
        "name": "Supplier",
        "email": "contact@example.com",
        "address": "1 Main Street",
    }]

    async def no_op():
        return None

    async def read_collection(collection, include_login_email=False):
        return [{"collection": collection}] if collection == "saved_reports" else []

    async def read_suppliers(include_contact=False):
        assert include_contact
        return supplier_rows

    async def read_settings():
        return {}

    monkeypatch.setattr(data, "archive_stale_routes", no_op)
    monkeypatch.setattr(data, "read_collection", read_collection)
    monkeypatch.setattr(data, "read_suppliers", read_suppliers)
    monkeypatch.setattr(data, "read_settings", read_settings)

    payload = asyncio.run(data.all_data({"role": role, "_id": "account-1"}))

    assert payload["reports"] == [{"collection": "saved_reports"}]
    assert payload["suppliers"] == supplier_rows


def test_all_data_limits_technicians_to_allowed_collections(monkeypatch):
    read_collections = []

    async def no_op():
        return None

    async def read_collection(collection, include_login_email=False):
        read_collections.append(collection)
        return [{"collection": collection}]

    async def read_suppliers(include_contact=False):
        return [{"id": "supplier-1", "name": "Supplier"}]

    async def read_settings():
        return {}

    monkeypatch.setattr(data, "archive_stale_routes", no_op)
    monkeypatch.setattr(data, "read_collection", read_collection)
    monkeypatch.setattr(data, "read_suppliers", read_suppliers)
    monkeypatch.setattr(data, "read_settings", read_settings)

    payload = asyncio.run(data.all_data({"role": "technician", "_id": "tech-1"}))

    assert set(read_collections) == {
        "users",
        "cases",
        "tooth_orders",
        "material_orders",
        "notifications",
    }
    assert payload["users"] == [{"collection": "users"}]
    assert payload["suppliers"] == [{"id": "supplier-1", "name": "Supplier"}]
    assert "clinics" not in payload
    assert "routes" not in payload
    assert "reports" not in payload


def test_one_collection_returns_only_supplier_names_to_technicians(monkeypatch):
    async def read_suppliers(include_contact=False):
        assert not include_contact
        return [{"id": "supplier-1", "name": "Supplier"}]

    async def read_collection(*args, **kwargs):
        pytest.fail("Supplier collection should use its safe projection.")

    monkeypatch.setattr(data, "read_suppliers", read_suppliers)
    monkeypatch.setattr(data, "read_collection", read_collection)

    result = asyncio.run(
        data.one_collection(
            "suppliers", {"role": "technician", "_id": "tech-1"}
        )
    )

    assert result == [{"id": "supplier-1", "name": "Supplier"}]


def test_one_collection_returns_supplier_contact_to_managers(monkeypatch):
    async def read_suppliers(include_contact=False):
        assert include_contact
        return [{
            "id": "supplier-1",
            "name": "Supplier",
            "email": "contact@example.com",
            "address": "1 Main Street",
        }]

    monkeypatch.setattr(data, "read_suppliers", read_suppliers)

    result = asyncio.run(
        data.one_collection(
            "suppliers", {"role": "manager", "_id": "manager-1"}
        )
    )

    assert result == [{
        "id": "supplier-1",
        "name": "Supplier",
        "email": "contact@example.com",
        "address": "1 Main Street",
    }]


def test_driver_data_reads_only_the_drivers_own_records(monkeypatch):
    rows = {
        "drivers": [{"id": "driver-1"}],
        "routes": [{"id": "route-1", "driverId": "driver-1"}],
        "stops": [
            {"id": "stop-1", "routeId": "route-1", "clinicId": "clinic-2"},
            {"id": "stop-2", "routeId": "route-1", "clinicId": "clinic-1"},
        ],
        "route_plans": [{"id": "route-1", "routeId": "route-1"}],
        "clinics": [{"id": "clinic-1"}, {"id": "clinic-2"}],
    }
    queries = {}

    async def read_collection(collection, include_login_email=False, query=None):
        queries[collection] = query
        return rows[collection]

    monkeypatch.setattr(data, "read_collection", read_collection)

    scoped = asyncio.run(data.driver_data({"_id": "driver-1", "role": "driver"}))

    assert queries == {
        "drivers": {"_id": "driver-1"},
        "routes": {"driverId": "driver-1", "archived": {"$ne": True}},
        "stops": {"routeId": {"$in": ["route-1"]}},
        "route_plans": {"routeId": {"$in": ["route-1"]}},
        "clinics": {"_id": {"$in": ["clinic-1", "clinic-2"]}},
    }
    assert scoped == {
        "drivers": rows["drivers"],
        "clinics": rows["clinics"],
        "routes": rows["routes"],
        "stops": rows["stops"],
        "routePlans": rows["route_plans"],
    }


def test_all_data_for_drivers_skips_full_collection_reads(monkeypatch):
    async def no_op():
        return None

    async def driver_data(account):
        assert account["_id"] == "driver-1"
        return {"drivers": [], "clinics": [], "routes": [], "stops": [], "routePlans": []}

    async def read_collection(*args, **kwargs):
        pytest.fail("Drivers must not read whole collections.")

    async def read_settings():
        return {"startEircode": "D06"}

    monkeypatch.setattr(data, "archive_stale_routes", no_op)
    monkeypatch.setattr(data, "driver_data", driver_data)
    monkeypatch.setattr(data, "read_collection", read_collection)
    monkeypatch.setattr(data, "read_settings", read_settings)

    payload = asyncio.run(data.all_data({"role": "driver", "_id": "driver-1"}))

    assert set(payload) == {
        "drivers", "clinics", "routes", "stops", "routePlans", "materialOrders", "settings",
    }
    assert "cases" not in payload
    assert payload["settings"] == {"startEircode": "D06"}


def test_driver_collection_endpoint_returns_scoped_clinics(monkeypatch):
    async def all_data(account):
        assert account["_id"] == "driver-1"
        return {"clinics": [{"id": "clinic-1"}]}

    async def read_collection(*args, **kwargs):
        pytest.fail("Driver collections must be returned through scoped data.")

    monkeypatch.setattr(data, "all_data", all_data)
    monkeypatch.setattr(data, "read_collection", read_collection)

    result = asyncio.run(
        data.one_collection("clinics", {"role": "driver", "_id": "driver-1"})
    )

    assert result == [{"id": "clinic-1"}]


@pytest.mark.parametrize(
    ("role", "collection"),
    [
        ("technician", "reports"),
        ("technician", "clinics"),
        ("technician", "routes"),
        ("driver", "reports"),
        ("driver", "suppliers"),
    ],
)
def test_one_collection_denies_unauthorized_collections(monkeypatch, role, collection):
    async def read_collection(*args, **kwargs):
        pytest.fail("Unauthorized collections must be denied before reading.")

    monkeypatch.setattr(data, "read_collection", read_collection)

    with pytest.raises(HTTPException) as error:
        asyncio.run(data.one_collection(collection, {"role": role, "_id": "account-1"}))

    assert error.value.status_code == 403


@pytest.mark.parametrize("role", ["owner", "manager"])
def test_one_collection_allows_reports_for_managers(monkeypatch, role):
    async def read_collection(collection, include_login_email=False):
        assert collection == "saved_reports"
        return [{"id": "report-1"}]

    monkeypatch.setattr(data, "read_collection", read_collection)

    assert asyncio.run(data.one_collection("reports", {"role": role})) == [
        {"id": "report-1"}
    ]
