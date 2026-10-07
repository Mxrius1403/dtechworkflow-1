import asyncio

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from routers import tooth_orders


class FakeToothOrdersCollection:
    def __init__(self):
        self.documents = {}

    async def insert_one(self, document):
        self.documents[document["_id"]] = document

    async def delete_one(self, query):
        deleted = self.documents.pop(query["_id"], None)
        return type("DeleteResult", (), {"deleted_count": int(deleted is not None)})()

    async def update_one(self, query, update):
        document = self.documents.get(query["_id"])
        if document is None:
            return type("UpdateResult", (), {"matched_count": 0})()
        document.update(update["$set"])
        return type("UpdateResult", (), {"matched_count": 1})()


class FakeDatabase:
    def __init__(self):
        self.collection = FakeToothOrdersCollection()

    def __getitem__(self, name):
        assert name == "tooth_orders"
        return self.collection


def test_tooth_order_requires_items_and_positive_quantities():
    with pytest.raises(ValidationError):
        tooth_orders.ToothOrderSubmit.model_validate({"items": []})
    with pytest.raises(ValidationError):
        tooth_orders.ToothOrderSubmit.model_validate(
            {"items": [{"group": "Upper Anteriors", "tooth": "S1", "shade": "A1", "qty": 0}]}
        )


def test_submit_and_manager_delete_tooth_order(monkeypatch):
    database = FakeDatabase()
    monkeypatch.setattr(tooth_orders, "db", database)
    body = tooth_orders.ToothOrderSubmit.model_validate(
        {
            "items": [
                {"group": "Upper Anteriors", "tooth": "S1", "shade": "A1", "qty": 2},
                {"group": "Lower Anteriors", "tooth": "L4", "shade": "B2", "qty": 1},
            ]
        }
    )
    account = {"_id": "TECH001", "name": "Test Technician"}

    saved = asyncio.run(tooth_orders.submit_tooth_order(body, account))
    stored = database.collection.documents[saved["id"]]

    assert saved["technicianId"] == account["_id"]
    assert saved["technician"] == account["name"]
    assert saved["items"] == [item.model_dump() for item in body.items]
    assert saved["total"] == 3
    assert saved["status"] == "pending"
    assert stored["createdAt"].endswith("Z")

    deleted = asyncio.run(tooth_orders.delete_tooth_order(saved["id"]))
    assert deleted == {"id": saved["id"], "deleted": True}
    assert not database.collection.documents


def test_manager_marks_tooth_order_done(monkeypatch):
    database = FakeDatabase()
    database.collection.documents["order-1"] = {"_id": "order-1", "status": "pending"}
    monkeypatch.setattr(tooth_orders, "db", database)
    body = tooth_orders.ToothOrderStatusUpdate.model_validate({"status": "done"})

    result = asyncio.run(tooth_orders.update_tooth_order_status("order-1", body))

    assert result == {"id": "order-1", "status": "done"}
    assert database.collection.documents["order-1"]["status"] == "done"


def test_marking_missing_tooth_order_done_returns_404(monkeypatch):
    monkeypatch.setattr(tooth_orders, "db", FakeDatabase())
    body = tooth_orders.ToothOrderStatusUpdate.model_validate({"status": "done"})

    with pytest.raises(HTTPException) as error:
        asyncio.run(tooth_orders.update_tooth_order_status("missing", body))
    assert error.value.status_code == 404


def test_delete_missing_tooth_order_returns_404(monkeypatch):
    monkeypatch.setattr(tooth_orders, "db", FakeDatabase())
    with pytest.raises(HTTPException) as error:
        asyncio.run(tooth_orders.delete_tooth_order("missing"))
    assert error.value.status_code == 404
