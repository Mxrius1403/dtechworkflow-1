import asyncio

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from routers import products


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = documents or {}

    async def find_one(self, query):
        return self.documents.get(query["_id"])

    def find(self):
        return self

    async def to_list(self, _limit):
        return list(self.documents.values())

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
        self.collections = {
            "products": FakeCollection(),
            "suppliers": FakeCollection({"supplier-1": {"_id": "supplier-1", "name": "Supplier Ltd"}}),
        }

    def __getitem__(self, name):
        return self.collections[name]


def product_payload(**changes):
    return {
        "refNo": "REF-100",
        "title": "Dental Product",
        "producer": "Producer Ltd",
        "supplierId": "supplier-1",
        "unit": "Bottle",
        "quantity": "100/1",
        "measure": "ml",
        **changes,
    }


def test_product_fields_are_required_and_trimmed():
    with pytest.raises(ValidationError):
        products.ProductCreate.model_validate(product_payload(title="  "))

    assert products.ProductCreate.model_validate(
        product_payload(title="  Dental Product  ")
    ).title == "Dental Product"


def test_list_create_update_and_delete_products(monkeypatch):
    database = FakeDatabase()
    monkeypatch.setattr(products, "db", database)
    body = products.ProductCreate.model_validate(product_payload())

    created = asyncio.run(products.create_product(body))
    assert created == {"id": created["id"], **body.model_dump()}
    assert database.collections["products"].documents[created["id"]] == {
        "_id": created["id"],
        **body.model_dump(),
    }
    assert asyncio.run(products.list_products()) == [created]

    updated_body = products.ProductCreate.model_validate(
        product_payload(title="Updated Product")
    )
    updated = asyncio.run(products.update_product(created["id"], updated_body))
    assert updated == {"id": created["id"], **updated_body.model_dump()}
    assert database.collections["products"].documents[created["id"]]["title"] == "Updated Product"

    deleted = asyncio.run(products.delete_product(created["id"]))
    assert deleted == {"id": created["id"], "deleted": True}
    assert not database.collections["products"].documents


def test_products_require_an_existing_supplier(monkeypatch):
    database = FakeDatabase()
    monkeypatch.setattr(products, "db", database)
    body = products.ProductCreate.model_validate(
        product_payload(supplierId="missing")
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(products.create_product(body))
    assert error.value.status_code == 422


def test_product_update_and_delete_missing_product_return_404(monkeypatch):
    monkeypatch.setattr(products, "db", FakeDatabase())
    body = products.ProductCreate.model_validate(product_payload())

    with pytest.raises(HTTPException) as update_error:
        asyncio.run(products.update_product("missing", body))
    assert update_error.value.status_code == 404

    with pytest.raises(HTTPException) as delete_error:
        asyncio.run(products.delete_product("missing"))
    assert delete_error.value.status_code == 404


def test_product_routes_are_limited_to_managers_and_owners():
    for route in products.router.routes:
        if route.path not in (
            "/api/products",
            "/api/products/{product_id}",
        ):
            continue
        role_check = next(
            dependency.call
            for dependency in route.dependant.dependencies
            if getattr(dependency.call, "__name__", None) == "check_role"
        )
        for role in ("owner", "manager"):
            assert asyncio.run(role_check({"role": role}))["role"] == role
        with pytest.raises(HTTPException) as error:
            asyncio.run(role_check({"role": "technician"}))
        assert error.value.status_code == 403
