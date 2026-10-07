import asyncio

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from routers import suppliers


class FakeSuppliersCollection:
    def __init__(self):
        self.documents = {}

    async def insert_one(self, document):
        self.documents[document["_id"]] = document

    async def update_one(self, query, update):
        document = self.documents.get(query["_id"])
        if document is None:
            return type("UpdateResult", (), {"matched_count": 0})()
        document.update(update["$set"])
        return type("UpdateResult", (), {"matched_count": 1})()

    async def delete_one(self, query):
        deleted = self.documents.pop(query["_id"], None)
        return type("DeleteResult", (), {"deleted_count": int(deleted is not None)})()


class FakeDatabase:
    def __init__(self):
        self.collection = FakeSuppliersCollection()

    def __getitem__(self, name):
        assert name == "suppliers"
        return self.collection


def test_supplier_name_is_required_and_trimmed():
    with pytest.raises(ValidationError):
        suppliers.SupplierCreate.model_validate({"name": "   "})

    assert (
        suppliers.SupplierCreate.model_validate({"name": "  Supplier Ltd  "}).name
        == "Supplier Ltd"
    )


def test_create_and_delete_supplier(monkeypatch):
    database = FakeDatabase()
    monkeypatch.setattr(suppliers, "db", database)

    created = asyncio.run(
        suppliers.create_supplier(
            suppliers.SupplierCreate.model_validate({"name": "Supplier Ltd"})
        )
    )
    assert created["name"] == "Supplier Ltd"
    assert set(created) == {"id", "name"}
    assert database.collection.documents[created["id"]] == {
        "_id": created["id"],
        "name": "Supplier Ltd",
    }

    updated = asyncio.run(
        suppliers.update_supplier(
            created["id"],
            suppliers.SupplierCreate.model_validate({"name": "Updated Supplier"}),
        )
    )
    assert updated == {"id": created["id"], "name": "Updated Supplier"}
    assert database.collection.documents[created["id"]]["name"] == "Updated Supplier"

    deleted = asyncio.run(suppliers.delete_supplier(created["id"]))
    assert deleted == {"id": created["id"], "deleted": True}
    assert not database.collection.documents


def test_delete_missing_supplier_returns_404(monkeypatch):
    monkeypatch.setattr(suppliers, "db", FakeDatabase())

    with pytest.raises(HTTPException) as error:
        asyncio.run(suppliers.delete_supplier("missing"))
    assert error.value.status_code == 404


def test_update_missing_supplier_returns_404(monkeypatch):
    monkeypatch.setattr(suppliers, "db", FakeDatabase())

    with pytest.raises(HTTPException) as error:
        asyncio.run(
            suppliers.update_supplier(
                "missing", suppliers.SupplierCreate.model_validate({"name": "Supplier"})
            )
        )
    assert error.value.status_code == 404
