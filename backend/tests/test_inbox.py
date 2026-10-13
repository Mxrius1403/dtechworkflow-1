import asyncio
from datetime import datetime, timezone

import pytest
from core import inbox as inbox_core
from fastapi import HTTPException
from routers import inbox


class Result:
    def __init__(self, **values):
        self.__dict__.update(values)


def matches(document, query):
    for field, expected in query.items():
        value = document.get(field)
        if isinstance(expected, dict):
            if "$in" in expected and value not in expected["$in"]:
                return False
            if "$ne" in expected and value == expected["$ne"]:
                return False
        elif value != expected:
            return False
    return True


class FakeCursor:
    def __init__(self, documents):
        self.documents = documents

    def sort(self, field, direction):
        self.documents.sort(key=lambda d: d[field], reverse=direction < 0)
        return self

    def limit(self, count):
        self.documents = self.documents[:count]
        return self

    async def to_list(self, length):
        return list(self.documents)


class FakeCollection:
    def __init__(self, documents=()):
        self.documents = {d["_id"]: dict(d) for d in documents}

    def find(self, query, projection=None):
        return FakeCursor([d for d in self.documents.values() if matches(d, query)])

    async def insert_many(self, documents):
        for document in documents:
            self.documents[document["_id"]] = document

    async def count_documents(self, query):
        return sum(1 for d in self.documents.values() if matches(d, query))

    async def update_one(self, query, update):
        for document in self.documents.values():
            if matches(document, query):
                document.update(update["$set"])
                return Result(matched_count=1, modified_count=1)
        return Result(matched_count=0, modified_count=0)

    async def update_many(self, query, update):
        hits = [d for d in self.documents.values() if matches(d, query)]
        for document in hits:
            document.update(update["$set"])
        return Result(matched_count=len(hits), modified_count=len(hits))

    async def delete_one(self, query):
        for key, document in list(self.documents.items()):
            if matches(document, query):
                del self.documents[key]
                return Result(deleted_count=1)
        return Result(deleted_count=0)


class FakeDatabase:
    def __init__(self, users=()):
        self.collections = {
            "auth_users": FakeCollection(users),
            "inbox_messages": FakeCollection(),
        }

    def __getitem__(self, name):
        return self.collections[name]


USERS = [
    {"_id": "OWNER", "role": "owner", "active": True},
    {"_id": "MGR1", "role": "manager", "active": True},
    {"_id": "MGR2", "role": "manager", "active": False},
    {"_id": "TECH", "role": "technician", "active": True},
]


def deliver(database, actor):
    asyncio.run(
        inbox_core.notify_managers(
            database,
            kind="tooth_order_created",
            title="New tooth order TO1",
            body="Tech ordered 3 teeth.",
            target="toothOrder",
            target_id="TO1",
            actor=actor,
        )
    )


def test_notify_managers_reaches_active_managers_except_actor():
    database = FakeDatabase(USERS)
    deliver(database, {"_id": "MGR1", "name": "Manager One"})

    messages = list(database["inbox_messages"].documents.values())
    assert [m["recipientId"] for m in messages] == ["OWNER"]
    assert messages[0]["by"] == "Manager One"
    assert messages[0]["read"] is False
    assert messages[0]["target"] == "toothOrder"


def test_notify_managers_never_fails_the_caller():
    class BrokenDatabase:
        def __getitem__(self, name):
            raise RuntimeError("database offline")

    deliver(BrokenDatabase(), {"_id": "TECH", "name": "Tech"})


def test_inbox_routes_require_manager_roles():
    role_check = next(
        dependency.dependency
        for dependency in inbox.router.dependencies
        if getattr(dependency.dependency, "__name__", None) == "check_role"
    )
    for role in ("owner", "manager"):
        assert asyncio.run(role_check({"role": role}))["role"] == role
    for role in ("technician", "driver"):
        with pytest.raises(HTTPException) as error:
            asyncio.run(role_check({"role": role}))
        assert error.value.status_code == 403


def test_list_read_and_delete_only_touch_own_messages(monkeypatch):
    database = FakeDatabase(USERS)
    monkeypatch.setattr(inbox, "db", database)
    deliver(database, {"_id": "TECH", "name": "Tech"})
    owner, manager = {"_id": "OWNER"}, {"_id": "MGR1"}

    listing = asyncio.run(inbox.list_inbox(owner))
    assert listing["unread"] == 1
    [message] = listing["messages"]
    assert message["createdAt"].endswith("Z")
    assert message["title"] == "New tooth order TO1"

    with pytest.raises(HTTPException) as error:
        asyncio.run(inbox.delete_inbox_message(message["id"], manager))
    assert error.value.status_code == 404

    asyncio.run(inbox.set_inbox_read(message["id"], inbox.InboxReadUpdate(read=True), owner))
    assert asyncio.run(inbox.list_inbox(owner))["unread"] == 0
    assert asyncio.run(inbox.list_inbox(manager))["unread"] == 1

    assert asyncio.run(inbox.mark_all_inbox_read(manager)) == {"updated": 1}
    assert asyncio.run(inbox.list_inbox(manager))["unread"] == 0

    assert asyncio.run(inbox.delete_inbox_message(message["id"], owner))["deleted"]
    assert asyncio.run(inbox.list_inbox(owner))["messages"] == []
    assert len(asyncio.run(inbox.list_inbox(manager))["messages"]) == 1


def test_naive_mongo_datetimes_are_returned_as_utc():
    doc = {"_id": "M1", "createdAt": datetime(2026, 10, 13, 9, 30)}
    assert inbox_core.inbox_message_to_api(doc)["createdAt"] == "2026-10-13T09:30:00.000Z"
    aware = {"_id": "M2", "createdAt": datetime(2026, 10, 13, 9, 30, tzinfo=timezone.utc)}
    assert inbox_core.inbox_message_to_api(aware)["createdAt"] == "2026-10-13T09:30:00.000Z"
