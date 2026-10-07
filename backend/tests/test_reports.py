import asyncio

import pytest
from pydantic import ValidationError
from routers import reports


class FakeReportsCollection:
    def __init__(self):
        self.documents = {}

    async def insert_one(self, document):
        self.documents[document["_id"]] = document

    async def delete_one(self, query):
        deleted = self.documents.pop(query["_id"], None)
        return type("DeleteResult", (), {"deleted_count": int(deleted is not None)})()


class FakeDatabase:
    def __init__(self):
        self.collection = FakeReportsCollection()

    def __getitem__(self, name):
        assert name == "saved_reports"
        return self.collection


def test_report_data_must_match_requested_period():
    with pytest.raises(ValidationError, match="Report data must match the selected period"):
        reports.ReportSave.model_validate(
            {
                "from": "2026-10-05",
                "to": "2026-10-11",
                "data": {"from": "2026-09-28", "to": "2026-10-04"},
            }
        )


def test_save_and_delete_report_persists_snapshot(monkeypatch):
    database = FakeDatabase()
    monkeypatch.setattr(reports, "db", database)
    body = reports.ReportSave.model_validate(
        {
            "from": "2026-10-05",
            "to": "2026-10-11",
            "data": {"from": "2026-10-05", "to": "2026-10-11", "cases": [1]},
        }
    )
    account = {"_id": "MGR0001"}

    saved = asyncio.run(reports.save_report(body, account))
    stored = database.collection.documents[saved["id"]]

    assert saved["data"] == body.data
    assert stored["data"] == body.data
    assert stored["createdById"] == account["_id"]
    deleted = asyncio.run(reports.delete_report(saved["id"]))
    assert deleted == {"id": saved["id"], "deleted": True}
    assert not database.collection.documents
