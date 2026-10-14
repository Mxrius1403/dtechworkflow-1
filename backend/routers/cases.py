"""Case reads beyond the active working set: search, a single case and report periods."""

import asyncio
import re
from datetime import date, timedelta

from core.cases import CASE_PROJECTION, case_to_api
from core.database import db
from core.security import require_roles
from fastapi import APIRouter, Depends, HTTPException, Query

router = APIRouter(prefix="/api/cases", tags=["cases"])
STAFF = Depends(require_roles("owner", "manager", "technician"))
MANAGERS = Depends(require_roles("owner", "manager"))

MAX_PAGE_SIZE = 100
SEARCH_FIELDS = (
    "code",
    "status",
    "department",
    "technician",
    "finishedBy",
    "technicianId",
    "finishedById",
)
REMOVED_LABEL = "removed from queue"
NEWEST_FIRST = [("updatedAt", -1), ("_id", -1)]


def case_list_query(q: str = "", code: str = "", technician_id: str = "") -> dict:
    """q: text anywhere in the searchable fields • code: exact case number •
    technician_id: cases started or finished by that technician."""
    clauses = []
    search = q.strip().lower()
    if search:
        pattern = {"$regex": re.escape(search), "$options": "i"}
        matches = [{field: pattern} for field in SEARCH_FIELDS]
        if search in REMOVED_LABEL:
            matches.append({"status": "removed"})
        clauses.append({"$or": matches})
    if code:
        clauses.append({"code": code})
    if technician_id:
        clauses.append(
            {"$or": [{"technicianId": technician_id}, {"finishedById": technician_id}]}
        )
    if not clauses:
        return {}
    return clauses[0] if len(clauses) == 1 else {"$and": clauses}


@router.get("", dependencies=[STAFF])
async def list_cases(
    q: str = Query("", max_length=100),
    code: str = Query("", max_length=64),
    technicianId: str = Query("", max_length=100),
    page: int = Query(0, ge=0),
    pageSize: int = Query(25, ge=1, le=MAX_PAGE_SIZE),
) -> dict:
    """Every case, including removed ones, newest first and one page at a time."""
    query = case_list_query(q, code, technicianId)
    cursor = (
        db["cases"]
        .find(query, CASE_PROJECTION)
        .sort(NEWEST_FIRST)
        .skip(page * pageSize)
        .limit(pageSize)
    )
    docs, total = await asyncio.gather(
        cursor.to_list(pageSize), db["cases"].count_documents(query)
    )
    return {
        "cases": [case_to_api(doc) for doc in docs],
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }


@router.get("/finished", dependencies=[MANAGERS])
async def finished_cases(
    from_date: date = Query(alias="from"), to_date: date = Query(alias="to")
) -> dict:
    """Cases with work finished in the period, for production reports."""
    if from_date > to_date:
        raise HTTPException(
            status_code=422, detail="The start date must be on or before the end date."
        )
    # Finish times are stored in UTC. A spare day on each side covers the lab's
    # timezone; the report itself applies the exact local period.
    window = {
        "$gte": (from_date - timedelta(days=1)).isoformat(),
        "$lt": (to_date + timedelta(days=2)).isoformat(),
    }
    query = {
        "deleted": {"$ne": True},
        "$or": [
            {"workSessions": {"$elemMatch": {"finishedAt": window}}},
            {"finishedAt": window},
        ],
    }
    docs = await db["cases"].find(query, CASE_PROJECTION).to_list(None)
    return {"cases": [case_to_api(doc) for doc in docs]}


@router.get("/{case_id}", dependencies=[STAFF])
async def read_case(case_id: str) -> dict:
    doc = await db["cases"].find_one({"_id": case_id}, CASE_PROJECTION)
    if not doc:
        raise HTTPException(status_code=404, detail="Case not found.")
    return case_to_api(doc)
