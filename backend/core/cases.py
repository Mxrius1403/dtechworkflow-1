"""Shared case reads: the active working set, list projection and indexes."""

from core.models import BaseDocument

# Cases that still appear on the boards. Completed cases leave this set when they are
# removed from the queue (manually or automatically after 10 days).
ACTIVE_STATUSES = ("queue", "production", "completed")
ACTIVE_CASES = {"deleted": {"$ne": True}, "status": {"$in": list(ACTIVE_STATUSES)}}

# The embedded `history` array grows with every change and is read through
# /api/receiving/cases/{id}/history instead. Only the action text is loaded,
# so `case_to_api` can still flag legacy "marked overdue" entries.
CASE_PROJECTION = {"history.at": 0, "history.by": 0}


def case_to_api(doc: dict) -> dict:
    history = doc.pop("history", None)
    row = BaseDocument.from_mongo(doc).to_api()
    if isinstance(history, list) and any(
        "marked overdue" in str(entry.get("action") or "").lower()
        for entry in history
        if isinstance(entry, dict)
    ):
        row["markedOverdue"] = True
    return row


async def read_active_cases(database) -> list[dict]:
    docs = await database["cases"].find(ACTIVE_CASES, CASE_PROJECTION).to_list(None)
    return [case_to_api(doc) for doc in docs]


async def ensure_case_indexes(database) -> None:
    cases = database["cases"]
    await cases.create_index([("status", 1), ("finishedAt", 1)])
    await cases.create_index("code")
    await cases.create_index([("updatedAt", -1), ("_id", -1)])
    await cases.create_index([("technicianId", 1), ("updatedAt", -1)])
    await cases.create_index([("finishedById", 1), ("updatedAt", -1)])
    await cases.create_index("finishedAt")
    await cases.create_index("workSessions.finishedAt")
    await cases.create_index("reentryCycles.finishedAt")
