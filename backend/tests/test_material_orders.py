import asyncio

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from routers import data, material_orders


class FakeCollection:
    def __init__(self, documents=()):
        self.documents = {document["_id"]: document for document in documents}

    async def find_one(self, query):
        return self.documents.get(query["_id"])

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
            "products": FakeCollection(
                [
                    {
                        "_id": "product-1",
                        "refNo": "REF-1",
                        "title": "Dental material",
                        "producer": "Brand",
                        "quantity": "10",
                        "unit": "pcs",
                        "measure": "box",
                    }
                ]
            ),
            "material_orders": FakeCollection(),
        }

    def __getitem__(self, name):
        return self.collections[name]


def test_material_order_requires_items_and_positive_quantities():
    with pytest.raises(ValidationError):
        material_orders.MaterialOrderSubmit.model_validate({"items": []})
    with pytest.raises(ValidationError):
        material_orders.MaterialOrderSubmit.model_validate(
            {"items": [{"productId": "product-1", "qty": 0}]}
        )
    with pytest.raises(ValidationError):
        material_orders.MaterialOrderStatusUpdate.model_validate({"status": "ordered"})


def test_material_orders_are_scoped_to_the_requesting_technician():
    orders = [
        {"id": "order-1", "requestedById": "TECH001"},
        {"id": "order-2", "requestedById": "TECH002"},
    ]

    assert data.visible_material_orders(
        orders, {"_id": "TECH001", "role": "technician"}
    ) == [orders[0]]
    assert data.visible_material_orders(
        orders, {"_id": "MANAGER1", "role": "manager"}
    ) == orders


def test_material_order_route_roles_match_the_workflow():
    post_route = next(
        route
        for route in material_orders.router.routes
        if route.path == "/api/material-orders" and "POST" in route.methods
    )
    manager_route = next(
        route
        for route in material_orders.router.routes
        if route.path == "/api/material-orders/{order_id}/status"
    )

    post_role_check = next(
        dependency.call
        for dependency in post_route.dependant.dependencies
        if getattr(dependency.call, "__name__", None) == "check_role"
    )
    manager_role_check = next(
        dependency.call
        for dependency in manager_route.dependant.dependencies
        if getattr(dependency.call, "__name__", None) == "check_role"
    )

    for role in ("technician", "manager", "owner"):
        assert asyncio.run(post_role_check({"role": role}))["role"] == role
    for role in ("manager", "owner"):
        assert asyncio.run(manager_role_check({"role": role}))["role"] == role
    with pytest.raises(HTTPException) as error:
        asyncio.run(manager_role_check({"role": "technician"}))
    assert error.value.status_code == 403


def test_submit_material_order_saves_product_snapshots(monkeypatch):
    database = FakeDatabase()
    monkeypatch.setattr(material_orders, "db", database)
    body = material_orders.MaterialOrderSubmit.model_validate(
        {
            "items": [
                {"productId": "product-1", "qty": 2},
                {"productId": "product-1", "qty": 1},
            ],
            "notes": "  Please order soon  ",
        }
    )
    account = {"_id": "TECH001", "name": "Test Technician", "department": None}

    saved = asyncio.run(material_orders.submit_material_order(body, account))
    stored = database["material_orders"].documents[saved["id"]]

    assert saved["requestedById"] == account["_id"]
    assert saved["requestedBy"] == account["name"]
    assert saved["items"] == [
        {
            "productId": "product-1",
            "code": "REF-1",
            "description": "Dental material",
            "brand": "Brand",
            "pack": "10 pcs box",
            "qty": 2,
        },
        {
            "productId": "product-1",
            "code": "REF-1",
            "description": "Dental material",
            "brand": "Brand",
            "pack": "10 pcs box",
            "qty": 1,
        },
    ]
    assert saved["totalItems"] == 3
    assert saved["notes"] == "Please order soon"
    assert saved["status"] == "pending"
    assert stored["createdAt"].endswith("Z")


def test_submit_material_order_rejects_removed_product(monkeypatch):
    monkeypatch.setattr(material_orders, "db", FakeDatabase())
    body = material_orders.MaterialOrderSubmit.model_validate(
        {"items": [{"productId": "missing", "qty": 1}]}
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(
            material_orders.submit_material_order(
                body, {"_id": "TECH001", "name": "Test Technician"}
            )
        )
    assert error.value.status_code == 422


def test_manager_marks_material_order_done_and_deletes(monkeypatch):
    database = FakeDatabase()
    database["material_orders"].documents["order-1"] = {
        "_id": "order-1",
        "status": "pending",
    }
    monkeypatch.setattr(material_orders, "db", database)
    body = material_orders.MaterialOrderStatusUpdate.model_validate({"status": "done"})

    updated = asyncio.run(material_orders.update_material_order_status("order-1", body))
    assert updated == {"id": "order-1", "status": "done"}
    assert database["material_orders"].documents["order-1"]["status"] == "done"

    deleted = asyncio.run(material_orders.delete_material_order("order-1"))
    assert deleted == {"id": "order-1", "deleted": True}


def test_missing_material_order_actions_return_404(monkeypatch):
    monkeypatch.setattr(material_orders, "db", FakeDatabase())
    body = material_orders.MaterialOrderStatusUpdate.model_validate({"status": "done"})

    with pytest.raises(HTTPException) as update_error:
        asyncio.run(material_orders.update_material_order_status("missing", body))
    assert update_error.value.status_code == 404

    with pytest.raises(HTTPException) as delete_error:
        asyncio.run(material_orders.delete_material_order("missing"))
    assert delete_error.value.status_code == 404
