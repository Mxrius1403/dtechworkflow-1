"""Staff, drivers, clinics and settings for the demo."""
from datetime import date

from core.config import TIMEZONE
from seed.reference import CLINICS, COMPANY, DRIVERS, LAB_EIRCODE, STAFF


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


def leave_requests() -> list[dict]:
    return []


def tooth_orders() -> list[dict]:
    return []


def material_orders() -> list[dict]:
    return []


def settings(today: date) -> dict:
    return {"id": "app", "timezone": TIMEZONE, "labName": COMPANY, "startEircode": LAB_EIRCODE,
            "emailNotificationsEnabled": True, "nextDriverNumber": 5, "nextClinicNumber": 9,
            "nextManagerNumber": 3, "lastOpenDate": today.isoformat()}
