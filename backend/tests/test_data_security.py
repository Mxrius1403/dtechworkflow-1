import asyncio

import pytest
from fastapi import HTTPException
from routers import data


@pytest.mark.parametrize("role", ["technician", "driver"])
def test_all_data_omits_reports_for_non_managers(monkeypatch, role):
    async def no_op():
        return None

    async def read_collection(collection, include_login_email=False):
        return [{"collection": collection}] if collection == "saved_reports" else []

    async def read_suppliers():
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
    async def no_op():
        return None

    async def read_collection(collection, include_login_email=False):
        return [{"collection": collection}] if collection == "saved_reports" else []

    async def read_suppliers():
        return []

    async def read_settings():
        return {}

    monkeypatch.setattr(data, "archive_stale_routes", no_op)
    monkeypatch.setattr(data, "read_collection", read_collection)
    monkeypatch.setattr(data, "read_suppliers", read_suppliers)
    monkeypatch.setattr(data, "read_settings", read_settings)

    payload = asyncio.run(data.all_data({"role": role, "_id": "account-1"}))

    assert payload["reports"] == [{"collection": "saved_reports"}]


def test_all_data_limits_technicians_to_allowed_collections(monkeypatch):
    read_collections = []

    async def no_op():
        return None

    async def read_collection(collection, include_login_email=False):
        read_collections.append(collection)
        return [{"collection": collection}]

    async def read_suppliers():
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
    async def read_suppliers():
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


def test_driver_payload_limits_clinics_to_assigned_routes():
    payload = {
        "drivers": [{"id": "driver-1"}, {"id": "driver-2"}],
        "clinics": [{"id": "clinic-1"}, {"id": "clinic-2"}],
        "routes": [
            {"id": "route-1", "driverId": "driver-1"},
            {"id": "route-2", "driverId": "driver-2"},
        ],
        "stops": [
            {"id": "stop-1", "routeId": "route-1", "clinicId": "clinic-1"},
            {"id": "stop-2", "routeId": "route-2", "clinicId": "clinic-2"},
        ],
        "routePlans": [
            {"id": "route-1", "routeId": "route-1"},
            {"id": "route-2", "routeId": "route-2"},
        ],
        "cases": [{"id": "case-1"}],
    }

    scoped = data.driver_payload(payload, {"_id": "driver-1", "role": "driver"})

    assert scoped["drivers"] == [{"id": "driver-1"}]
    assert scoped["clinics"] == [{"id": "clinic-1"}]
    assert scoped["routes"] == [{"id": "route-1", "driverId": "driver-1"}]
    assert scoped["stops"] == [
        {"id": "stop-1", "routeId": "route-1", "clinicId": "clinic-1"}
    ]
    assert scoped["cases"] == []


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
