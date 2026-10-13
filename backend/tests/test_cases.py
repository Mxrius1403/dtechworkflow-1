import asyncio
from datetime import date

import pytest
from core import cases as core_cases
from core.cases import ACTIVE_CASES, CASE_PROJECTION, case_to_api, read_active_cases
from fastapi import HTTPException
from routers import cases


class FakeCursor:
    def __init__(self, documents):
        self.documents = documents
        self.calls = {}

    def sort(self, keys):
        self.calls["sort"] = keys
        return self

    def skip(self, count):
        self.calls["skip"] = count
        return self

    def limit(self, count):
        self.calls["limit"] = count
        return self

    async def to_list(self, length):
        self.calls["to_list"] = length
        return [dict(document) for document in self.documents]


class FakeCases:
    def __init__(self, documents=(), total=0):
        self.documents = list(documents)
        self.total = total
        self.finds = []
        self.counts = []
        self.cursor = None

    def find(self, query, projection=None):
        self.finds.append((query, projection))
        self.cursor = FakeCursor(self.documents)
        return self.cursor

    async def find_one(self, query, projection=None):
        self.finds.append((query, projection))
        return next(
            (dict(d) for d in self.documents if d["_id"] == query["_id"]), None
        )

    async def count_documents(self, query):
        self.counts.append(query)
        return self.total


class FakeDatabase:
    def __init__(self, collection):
        self.collection = collection

    def __getitem__(self, name):
        assert name == "cases"
        return self.collection


def use_cases(monkeypatch, documents=(), total=0):
    collection = FakeCases(documents, total)
    monkeypatch.setattr(cases, "db", FakeDatabase(collection))
    return collection


def role_check(path):
    route = next(r for r in cases.router.routes if r.path == path)
    return next(
        dependency.call
        for dependency in route.dependant.dependencies
        if getattr(dependency.call, "__name__", None) == "check_role"
    )


def test_case_to_api_drops_history_and_flags_legacy_overdue_entries():
    row = case_to_api(
        {
            "_id": "C1",
            "code": "A1",
            "history": [{"action": "Received"}, {"action": "Marked Overdue by Lab"}],
        }
    )

    assert row == {"id": "C1", "code": "A1", "markedOverdue": True}
    assert case_to_api({"_id": "C2", "history": [{"action": "Received"}]}) == {"id": "C2"}
    assert case_to_api({"_id": "C3"}) == {"id": "C3"}


def test_read_active_cases_loads_only_the_working_set_without_history():
    collection = FakeCases([{"_id": "C1", "status": "queue", "history": []}])

    rows = asyncio.run(read_active_cases(FakeDatabase(collection)))

    assert rows == [{"id": "C1", "status": "queue"}]
    assert collection.finds == [(ACTIVE_CASES, CASE_PROJECTION)]
    assert ACTIVE_CASES == {
        "deleted": {"$ne": True},
        "status": {"$in": ["queue", "production", "completed"]},
    }
    assert collection.cursor.calls["to_list"] is None


def test_ensure_case_indexes_covers_case_reads():
    created = []

    class IndexCollection:
        async def create_index(self, keys, **_options):
            created.append(keys)

    asyncio.run(core_cases.ensure_case_indexes({"cases": IndexCollection()}))

    assert [("status", 1), ("finishedAt", 1)] in created
    assert "code" in created
    assert [("updatedAt", -1), ("_id", -1)] in created
    assert "workSessions.finishedAt" in created


def test_case_list_query_without_filters_matches_everything():
    assert cases.case_list_query() == {}
    assert cases.case_list_query("   ") == {}


def test_case_list_query_searches_every_field_as_plain_text():
    query = cases.case_list_query(" A.1+ ")
    pattern = {"$regex": r"a\.1\+", "$options": "i"}

    assert query == {"$or": [{field: pattern} for field in cases.SEARCH_FIELDS]}


def test_case_list_query_matches_the_removed_from_queue_label():
    assert {"status": "removed"} in cases.case_list_query("from queue")["$or"]
    assert {"status": "removed"} not in cases.case_list_query("prosthesis")["$or"]


def test_case_list_query_combines_code_and_technician_filters():
    assert cases.case_list_query(code="A1") == {"code": "A1"}
    assert cases.case_list_query(code="A1", technician_id="DT001") == {
        "$and": [
            {"code": "A1"},
            {"$or": [{"technicianId": "DT001"}, {"finishedById": "DT001"}]},
        ]
    }


def test_list_cases_returns_one_page_newest_first(monkeypatch):
    collection = use_cases(
        monkeypatch,
        [{"_id": "C3", "code": "A3", "history": [{"action": "Received"}]}],
        total=51,
    )

    result = asyncio.run(
        cases.list_cases(q="a", code="", technicianId="", page=2, pageSize=25)
    )

    assert result == {
        "cases": [{"id": "C3", "code": "A3"}],
        "total": 51,
        "page": 2,
        "pageSize": 25,
    }
    query, projection = collection.finds[0]
    assert projection == CASE_PROJECTION
    assert collection.counts == [query]
    assert collection.cursor.calls == {
        "sort": [("updatedAt", -1), ("_id", -1)],
        "skip": 50,
        "limit": 25,
        "to_list": 25,
    }


def test_finished_cases_reads_the_period_with_a_spare_day_each_side(monkeypatch):
    collection = use_cases(monkeypatch, [{"_id": "C1", "history": []}])

    result = asyncio.run(cases.finished_cases(date(2026, 10, 5), date(2026, 10, 11)))

    window = {"$gte": "2026-10-04", "$lt": "2026-10-13"}
    assert result == {"cases": [{"id": "C1"}]}
    assert collection.finds == [
        (
            {
                "deleted": {"$ne": True},
                "$or": [
                    {"workSessions": {"$elemMatch": {"finishedAt": window}}},
                    {"finishedAt": window},
                ],
            },
            CASE_PROJECTION,
        )
    ]


def test_finished_cases_rejects_a_reversed_period(monkeypatch):
    use_cases(monkeypatch)

    with pytest.raises(HTTPException) as error:
        asyncio.run(cases.finished_cases(date(2026, 10, 11), date(2026, 10, 5)))

    assert error.value.status_code == 422


def test_read_case_returns_removed_cases_and_404_for_unknown_ones(monkeypatch):
    use_cases(monkeypatch, [{"_id": "C1", "status": "removed", "history": []}])

    assert asyncio.run(cases.read_case("C1")) == {"id": "C1", "status": "removed"}
    with pytest.raises(HTTPException) as error:
        asyncio.run(cases.read_case("C9"))
    assert error.value.status_code == 404


def test_case_routes_are_limited_to_staff_and_reports_to_managers():
    staff_checks = [role_check("/api/cases"), role_check("/api/cases/{case_id}")]
    manager_check = role_check("/api/cases/finished")

    for check in staff_checks:
        for role in ("owner", "manager", "technician"):
            assert asyncio.run(check({"role": role}))["role"] == role
        with pytest.raises(HTTPException) as error:
            asyncio.run(check({"role": "driver"}))
        assert error.value.status_code == 403
    for role in ("technician", "driver"):
        with pytest.raises(HTTPException) as error:
            asyncio.run(manager_check({"role": role}))
        assert error.value.status_code == 403
