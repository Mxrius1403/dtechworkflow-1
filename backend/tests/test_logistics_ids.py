import asyncio

from routers.logistics import allocate_entity_id


class FakeCursor:
    def __init__(self, documents):
        self.documents = iter(documents)

    def __aiter__(self):
        return self

    async def __anext__(self):
        try:
            return next(self.documents)
        except StopIteration:
            raise StopAsyncIteration from None


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = {document["_id"]: document for document in documents or []}

    def find(self, query, projection):
        prefix = query["_id"]["$regex"].split("\\d+")[0][1:]
        return FakeCursor(
            [{"_id": key} for key in self.documents if key.startswith(prefix)]
        )

    async def find_one_and_update(
        self, query, update, upsert=False, return_document=None
    ):
        document = self.documents.get(query["_id"])
        if document is None:
            if not upsert:
                return None
            document = {"_id": query["_id"]}
            self.documents[query["_id"]] = document
        for field, value in update.get("$max", {}).items():
            document[field] = max(document.get(field, value), value)
        for field, value in update.get("$inc", {}).items():
            document[field] = document.get(field, 0) + value
        return document


class FakeDatabase:
    def __init__(self, collection_name, existing_ids, settings=None):
        self.collections = {
            collection_name: FakeCollection(
                [{"_id": identifier} for identifier in existing_ids]
            ),
            "settings": FakeCollection(settings),
        }

    def __getitem__(self, name):
        return self.collections[name]


def test_clinic_id_allocation_starts_after_existing_ids(monkeypatch):
    from routers import logistics

    database = FakeDatabase("clinics", ["C0001", "C0007"])
    monkeypatch.setattr(logistics, "db", database)

    clinic_id = asyncio.run(allocate_entity_id("clinics", "nextClinicNumber", "C"))

    assert clinic_id == "C0008"
    assert database["settings"].documents["app"]["nextClinicNumber"] == 8


def test_driver_id_allocation_advances_a_stale_counter(monkeypatch):
    from routers import logistics

    database = FakeDatabase(
        "drivers",
        ["D0042"],
        [{"_id": "app", "nextDriverNumber": 3}],
    )
    monkeypatch.setattr(logistics, "db", database)

    driver_id = asyncio.run(allocate_entity_id("drivers", "nextDriverNumber", "D"))

    assert driver_id == "D0043"
    assert database["settings"].documents["app"]["nextDriverNumber"] == 43
