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


def test_supplier_contact_fields_are_optional_and_normalized():
    supplier = suppliers.SupplierCreate.model_validate({
        "name": "Supplier",
        "email": "  contact@example.com ",
        "address": "  1 Main Street  ",
    })
    assert supplier.email == "contact@example.com"
    assert supplier.address == "1 Main Street"

    empty_contact = suppliers.SupplierCreate.model_validate({
        "name": "Supplier",
        "email": " ",
        "address": " ",
    })
    assert empty_contact.email is None
    assert empty_contact.address is None

    with pytest.raises(ValidationError):
        suppliers.SupplierCreate.model_validate({
            "name": "Supplier",
            "email": "not-an-email",
        })


def test_create_and_delete_supplier(monkeypatch):
    database = FakeDatabase()
    monkeypatch.setattr(suppliers, "db", database)

    created = asyncio.run(
        suppliers.create_supplier(
            suppliers.SupplierCreate.model_validate({
                "name": "Supplier Ltd",
                "email": "contact@example.com",
                "address": "1 Main Street",
            })
        )
    )
    assert created["name"] == "Supplier Ltd"
    assert set(created) == {"id", "name", "email", "address"}
    assert database.collection.documents[created["id"]] == {
        "_id": created["id"],
        "name": "Supplier Ltd",
        "email": "contact@example.com",
        "address": "1 Main Street",
    }

    updated = asyncio.run(
        suppliers.update_supplier(
            created["id"],
            suppliers.SupplierCreate.model_validate({
                "name": "Updated Supplier",
                "email": "updated@example.com",
                "address": "2 Main Street",
            }),
        )
    )
    assert updated == {
        "id": created["id"],
        "name": "Updated Supplier",
        "email": "updated@example.com",
        "address": "2 Main Street",
    }
    assert database.collection.documents[created["id"]]["name"] == "Updated Supplier"
    assert database.collection.documents[created["id"]]["email"] == "updated@example.com"
    assert database.collection.documents[created["id"]]["address"] == "2 Main Street"

    renamed = asyncio.run(
        suppliers.update_supplier(
            created["id"],
            suppliers.SupplierCreate.model_validate({"name": "Renamed Supplier"}),
        )
    )
    assert renamed == {"id": created["id"], "name": "Renamed Supplier"}
    assert database.collection.documents[created["id"]]["email"] == "updated@example.com"
    assert database.collection.documents[created["id"]]["address"] == "2 Main Street"

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
