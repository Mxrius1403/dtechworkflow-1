"""Staff, drivers, clinics, leave, other work, orders and settings for the demo."""
import json
from datetime import date, timedelta

from core.config import DATA_DIR, TIMEZONE
from seed.calendar import next_production_day, production_days_back, working_days_between
from seed.cases import iso
from seed.reference import CLINICS, COMPANY, DRIVERS, LAB_EIRCODE, STAFF

STAFF_BY_ID = {s[0]: s for s in STAFF}


def users() -> list[dict]:
    return [{"id": sid, "uid": f"u-{sid.lower()}", "name": name, "role": role, "department": dept,
             "active": active, "owner": role == "owner", "createdAt": "2026-01-05T09:00:00.000Z"}
            for sid, name, role, dept, active in STAFF]


def drivers() -> list[dict]:
    return [{"id": did, "uid": f"u-{did.lower()}", "name": name, "active": active} for did, name, active in DRIVERS]


def clinics() -> list[dict]:
    return [{"id": cid, "name": name, "address": address, "eircode": eircode, "active": active, "hasEmail": bool(contact[0])}
            for cid, name, address, eircode, active, _, contact in CLINICS]


def clinic_contacts() -> list[dict]:
    return [{"id": cid, "email": c[0], "phone": c[1], "contact": c[2], "notes": c[3]}
            for cid, *_, c in CLINICS]


def leave(rid, tech, start: date, end: date, status, created: date, **extra) -> dict:
    _, name, _, dept, _ = STAFF_BY_ID[tech]
    return {"id": rid, "technicianId": tech, "technicianName": name, "department": dept,
            "from": start.isoformat(), "to": end.isoformat(), "workingDays": working_days_between(start, end),
            "status": status, "createdAt": iso(created, 10, 0), **extra}


def leave_requests(today: date) -> list[dict]:
    def from_offset(days):
        return next_production_day(today + timedelta(days=days))

    past, soon, later = from_offset(-18), from_offset(3), from_offset(8)
    return [
        leave("LEAVE-001", "DT001", past, past + timedelta(days=2), "approved", past - timedelta(days=20),
              approvedById="MGR0001", approvedBy="Ciarán Walsh"),
        leave("LEAVE-002", "DT002", soon, soon + timedelta(days=2), "approved", today - timedelta(days=9),
              approvedById="MGR0001", approvedBy="Ciarán Walsh"),
        leave("LEAVE-003", "DT004", later, later + timedelta(days=1), "approved", today - timedelta(days=4),
              approvedById="MGR0001", approvedBy="Ciarán Walsh"),
        leave("LEAVE-004", "DT003", from_offset(12), from_offset(12) + timedelta(days=4), "pending", today - timedelta(days=1)),
        leave("LEAVE-005", "DT005", from_offset(20), from_offset(20) + timedelta(days=2), "pending", today),
        leave("LEAVE-006", "DT004", from_offset(5), from_offset(5) + timedelta(days=1), "rejected", today - timedelta(days=6),
              rejectionReason="Clashes with ortho stock audit", rejectedBy="Ciarán Walsh"),
        leave("LEAVE-007", "DT001", from_offset(30), from_offset(30) + timedelta(days=1), "cancelled", today - timedelta(days=3)),
    ]


def other_work(today: date) -> list[dict]:
    p = production_days_back(today, 4)
    rows = [("OW-001", "DT003", p[0], (13, 0), (13, 45), "Wire Preparation"),
            ("OW-002", "DT003", p[1], (15, 10), (16, 0), "Model Preparation"),
            ("OW-003", "DT003", p[3], (8, 30), (9, 5), "Machine Setup"),
            ("OW-004", "DT004", p[0], (11, 0), (11, 30), "Quality Control"),
            ("OW-005", "DT004", today, (10, 0), None, "Cleaning / Maintenance")]
    out = []
    for rid, tech, day, start, end, activity in rows:
        item = {"id": rid, "code": "OW", "activity": activity, "technicianId": tech, "technicianName": STAFF_BY_ID[tech][1],
                "department": "ortho", "startedAt": iso(day, *start), "startedTime": f"{start[0]:02d}:{start[1]:02d}",
                "createdAt": iso(day, *start)}
        if end:
            item.update(finishedAt=iso(day, *end), finishedTime=f"{end[0]:02d}:{end[1]:02d}")
        out.append(item)
    return out


def tooth_orders(today: date) -> list[dict]:
    p1 = production_days_back(today, 1)[0]
    rows = [("ORD-0001", "DT001", today, (9, 45), [("Upper Anteriors", "S1", "A2", 2), ("Upper Anteriors", "T4", "A3", 1),
                                                  ("Lower Posteriors", "32", "A2", 4)]),
            ("ORD-0002", "DT003", p1, (14, 10), [("Lower Anteriors", "L6", "B1", 2), ("Upper Posteriors", "30", "A1", 2)])]
    return [{"id": rid, "status": "pending", "createdAt": iso(day, *t), "date": day.strftime("%a %d %b %Y"),
             "time": f"{t[0]:02d}:{t[1]:02d}", "technician": STAFF_BY_ID[tech][1], "technicianId": tech,
             "items": [{"group": g, "tooth": tooth, "shade": shade, "qty": qty} for g, tooth, shade, qty in items],
             "total": sum(i[3] for i in items)} for rid, tech, day, t, items in rows]


def material_orders(today: date) -> list[dict]:
    catalogue = {p["id"]: p for p in json.loads((DATA_DIR / "materials.json").read_text())}
    p = production_days_back(today, 5)
    rows = [("MAT-0001", "DT001", today, (10, 20), "pending", [("DT0001", 2), ("DT0003", 1)], "Needed before Friday"),
            ("MAT-0002", "DT003", p[1], (12, 5), "ordered", [("DT0006", 3), ("DT0009", 1)], ""),
            ("MAT-0003", "DT005", p[4], (9, 0), "received", [("DT0004", 2)], "")]
    out = []
    for rid, tech, day, t, status, items, notes in rows:
        lines = [{"productId": pid, "qty": qty, "notes": "", **{k: catalogue[pid][k] for k in
                  ("code", "description", "brand", "supplier", "group", "subgroup", "pack")}} for pid, qty in items]
        out.append({"id": rid, "status": status, "createdAt": iso(day, *t), "date": day.strftime("%a %d %b %Y"),
                    "time": f"{t[0]:02d}:{t[1]:02d}", "requestedBy": STAFF_BY_ID[tech][1], "requestedById": tech,
                    "department": STAFF_BY_ID[tech][3], "notes": notes, "items": lines,
                    "totalItems": sum(qty for _, qty in items)})
    return out


def settings(today: date) -> dict:
    return {"id": "app", "timezone": TIMEZONE, "labName": COMPANY, "startEircode": LAB_EIRCODE,
            "emailNotificationsEnabled": True, "nextDriverNumber": 5, "nextClinicNumber": 9,
            "nextManagerNumber": 3, "lastOpenDate": today.isoformat()}
