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

    async def read_settings():
        return {}

    monkeypatch.setattr(data, "archive_stale_routes", no_op)
    monkeypatch.setattr(data, "read_collection", read_collection)
    monkeypatch.setattr(data, "read_settings", read_settings)

    payload = asyncio.run(data.all_data({"role": role, "_id": "account-1"}))

    assert "reports" not in payload


@pytest.mark.parametrize("role", ["owner", "manager"])
def test_all_data_includes_reports_for_managers(monkeypatch, role):
    async def no_op():
        return None

    async def read_collection(collection, include_login_email=False):
        return [{"collection": collection}] if collection == "saved_reports" else []

    async def read_settings():
        return {}

    monkeypatch.setattr(data, "archive_stale_routes", no_op)
    monkeypatch.setattr(data, "read_collection", read_collection)
    monkeypatch.setattr(data, "read_settings", read_settings)

    payload = asyncio.run(data.all_data({"role": role, "_id": "account-1"}))

    assert payload["reports"] == [{"collection": "saved_reports"}]


@pytest.mark.parametrize("role", ["technician", "driver"])
def test_one_collection_denies_reports_to_non_managers(monkeypatch, role):
    async def read_collection(*args, **kwargs):
        pytest.fail("Reports must be denied before reading the collection.")

    monkeypatch.setattr(data, "read_collection", read_collection)

    with pytest.raises(HTTPException) as error:
        asyncio.run(data.one_collection("reports", {"role": role}))

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
