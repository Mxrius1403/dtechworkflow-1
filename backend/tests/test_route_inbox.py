import asyncio

import pytest
from pydantic import ValidationError
from routers import logistics


class Result:
    def __init__(self, **values):
        self.__dict__.update(values)


class FakeCursor:
    def __init__(self, documents):
        self.documents = documents

    async def to_list(self, length):
        return list(self.documents)


def matches(document, query):
    for field, expected in query.items():
        if isinstance(expected, dict) and "$in" in expected:
            if document.get(field) not in expected["$in"]:
                return False
        elif document.get(field) != expected:
            return False
    return True


class FakeCollection:
    def __init__(self, documents=()):
        self.documents = {d["_id"]: dict(d) for d in documents}

    def find(self, query, projection=None):
        return FakeCursor([d for d in self.documents.values() if matches(d, query)])

    async def find_one(self, query):
        return next((d for d in self.documents.values() if matches(d, query)), None)

    async def update_one(self, query, update):
        document = await self.find_one(query)
        if document is None:
            return Result(matched_count=0)
        document.update(update.get("$set", {}))
        for field in update.get("$unset", {}):
            document.pop(field, None)
        return Result(matched_count=1)


class FakeDatabase:
    def __init__(self, route, stops):
        self.collections = {
            "routes": FakeCollection([route]),
            "stops": FakeCollection(stops),
            "clinics": FakeCollection(
                [{"_id": "CL1", "name": "Swords Clinic"}, {"_id": "CL2", "name": "Wexford Clinic"}]
            ),
        }

    def __getitem__(self, name):
        return self.collections[name]


DRIVER = {"_id": "D1", "name": "Driver One", "role": "driver"}


def make_db(route_status="started"):
    route = {
        "_id": "R1",
        "driverId": "D1",
        "status": route_status,
        "startedAt": "2026-10-13T08:00:00+00:00",
    }
    stops = [
        {
            "_id": "R1-S001",
            "routeId": "R1",
            "clinicId": "CL1",
            "status": "completed",
            "deliveries": [{"caseNumber": "A1"}, {"caseNumber": "A2"}],
            "collections": [],
        },
        {
            "_id": "R1-S002",
            "routeId": "R1",
            "clinicId": "CL2",
            "status": "pending",
            "deliveries": [{"caseNumber": "B1"}],
            "collections": [{"notes": ""}],
        },
    ]
    return FakeDatabase(route, stops)


@pytest.fixture
def inbox(monkeypatch):
    sent = []

    async def notify_managers(_db, **message):
        sent.append(message)

    async def no_op(*_args, **_kwargs):
        return None

    monkeypatch.setattr(logistics, "notify_managers", notify_managers)
    monkeypatch.setattr(logistics, "set_stop_delivery_status", no_op)
    monkeypatch.setattr(logistics, "log_stop_case_events", no_op)
    return sent


def test_other_reason_needs_a_note():
    with pytest.raises(ValidationError):
        logistics.StopProblem(reason="other")
    assert logistics.StopProblem(reason="other", note="Gate locked").describe() == "Gate locked"
    assert logistics.StopProblem(reason="clinic_closed").describe() == "Clinic closed"
    assert (
        logistics.StopProblem(reason="clinic_closed", note="Back at 2pm").describe()
        == "Clinic closed: Back at 2pm"
    )


def test_start_route_tells_managers(monkeypatch, inbox):
    database = make_db("published")
    monkeypatch.setattr(logistics, "db", database)

    asyncio.run(logistics.start_route("R1", DRIVER))

    [message] = inbox
    assert message["kind"] == "route_started"
    assert message["target"] == "route" and message["target_id"] == "R1"
    assert message["body"] == "2 stops at 2 clinics, 3 cases out for delivery."


def test_report_stop_problem_saves_reason_and_warns_managers(monkeypatch, inbox):
    database = make_db()
    monkeypatch.setattr(logistics, "db", database)

    result = asyncio.run(
        logistics.report_stop_problem(
            "R1", "R1-S002", logistics.StopProblem(reason="clinic_closed"), DRIVER
        )
    )

    assert result["problem"]["label"] == "Clinic closed"
    assert database["stops"].documents["R1-S002"]["problem"]["reason"] == "clinic_closed"
    [message] = inbox
    assert message["severity"] == "warning"
    assert message["title"] == "Problem at Wexford Clinic (route R1)"
    assert "B1" in message["body"]


def test_report_problem_rejects_completed_stop(monkeypatch, inbox):
    monkeypatch.setattr(logistics, "db", make_db())
    with pytest.raises(logistics.HTTPException) as error:
        asyncio.run(
            logistics.report_stop_problem(
                "R1", "R1-S001", logistics.StopProblem(reason="clinic_closed"), DRIVER
            )
        )
    assert error.value.status_code == 409
    assert inbox == []


def test_checking_a_stop_clears_its_problem(monkeypatch, inbox):
    database = make_db()
    database["stops"].documents["R1-S002"]["problem"] = {"label": "Clinic closed"}
    monkeypatch.setattr(logistics, "db", database)

    asyncio.run(
        logistics.check_route_stop("R1", "R1-S002", logistics.StopCheck(checked=True), DRIVER)
    )

    assert "problem" not in database["stops"].documents["R1-S002"]


def test_finish_with_open_stop_sends_warning_with_reason(monkeypatch, inbox):
    database = make_db()
    monkeypatch.setattr(logistics, "db", database)
    body = logistics.RouteFinish(
        problems={"R1-S002": {"reason": "nobody_available", "note": "Called twice"}}
    )

    asyncio.run(logistics.finish_route("R1", body, DRIVER))

    assert database["routes"].documents["R1"]["status"] == "completed"
    assert (
        database["stops"].documents["R1-S002"]["problem"]["label"]
        == "Nobody available to receive: Called twice"
    )
    [message] = inbox
    assert message["severity"] == "warning"
    assert message["title"] == "Route R1 finished with 1 open stop"
    assert "Wexford Clinic (cases B1): Nobody available to receive: Called twice" in message["body"]
    assert "1 case set to Not Delivered" in message["body"]


def test_finish_with_all_stops_done_sends_success(monkeypatch, inbox):
    database = make_db()
    database["stops"].documents["R1-S002"]["status"] = "completed"
    monkeypatch.setattr(logistics, "db", database)

    asyncio.run(logistics.finish_route("R1", None, DRIVER))

    [message] = inbox
    assert message["severity"] == "success"
    assert message["title"] == "Route R1 completed"
    assert message["body"].startswith("All 2 stops done in ")
    assert message["body"].endswith("3 cases delivered, 1 collection.")


def test_duration_text():
    assert logistics.duration_text("2026-10-13T08:00:00+00:00", "2026-10-13T11:05:00+00:00") == "3 h 5 min"
    assert logistics.duration_text("2026-10-13T08:00:00Z", "2026-10-13T08:40:00Z") == "40 min"
    assert logistics.duration_text(None, "2026-10-13T08:40:00Z") == ""
