"""Builds production cases (with work sessions and history) for the demo seed."""
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from core.config import TIMEZONE
from seed.calendar import is_production_day, next_production_day, prev_production_day
from seed.reference import MANAGER, STAFF

TZ = ZoneInfo(TIMEZONE)
TECH_NAMES = {sid: name for sid, name, role, _, _ in STAFF if role == "technician"}


def iso(d: date, hh: int, mm: int) -> str:
    return datetime.combine(d, time(hh, mm), TZ).astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def hm(hh: int, mm: int) -> str:
    return f"{hh:02d}:{mm:02d}"


def shift(d: date, hh: int, mm: int, minutes: int) -> tuple[date, int, int]:
    moved = datetime.combine(d, time(hh, mm)) + timedelta(minutes=minutes)
    return moved.date(), moved.hour, moved.minute


class CaseBook:
    def __init__(self, today: date):
        self.today = today
        self.items: list[dict] = []
        self.confirmed: list[dict] = []  # every manager-confirmed production cycle

    def add(self, code, dept, due, *, received=None, types=(), arch="", attention="active", note=""):
        received = received or prev_production_day(min(due, self.today))
        rec_at = iso(received, 9, 5 + len(self.items) % 50)
        case = {
            "id": f"CASE{len(self.items) + 1:03d}-{code}", "code": code, "department": dept, "status": "queue",
            "scheduledDate": due.isoformat(), "originalScheduledDate": due.isoformat(), "currentDueDate": due.isoformat(),
            "missedScheduleDates": {}, "receivedDate": received.isoformat(), "receivedAt": rec_at,
            "receivedTime": rec_at[11:16], "serviceTypes": list(types), "arch": arch,
            "attentionStatus": attention, "attentionNote": note, "overdue": False, "wasOverdue": False,
            "overdueReasonRequired": False, "overdueReason": "", "technicianId": "", "technician": "",
            "startedAt": "", "startedTime": "", "finishedAt": "", "finishedDate": "", "finishedTime": "",
            "finishedById": "", "finishedBy": "", "completionReviewRequired": False, "completionReviewStatus": "",
            "managerConfirmedAt": "", "workSessions": [], "createdAt": rec_at, "updatedAt": rec_at,
            "history": [{"at": rec_at, "action": f"Received and scheduled for {due.isoformat()}", "by": MANAGER[1]}],
        }
        self.items.append(case)
        return case

    def overdue(self, case, original: date, *, until: date | None = None, reason=""):
        until = until or self.today
        carried = next_production_day(until)
        missed, d = {}, original
        while d < until:
            if is_production_day(d):
                missed[d.isoformat()] = True
                case["history"].append({"at": iso(d + timedelta(days=1), 7, 0),
                                        "action": f"Missed {d.isoformat()}; carried forward to {carried.isoformat()}", "by": "System"})
            d += timedelta(days=1)
        case.update(overdue=True, wasOverdue=True, originalScheduledDate=original.isoformat(),
                    scheduledDate=original.isoformat(), currentDueDate=carried.isoformat(),
                    missedScheduleDates=missed, overdueReason=reason)
        return case

    def start(self, case, tech_id, d, hh, mm):
        at, name = iso(d, hh, mm), TECH_NAMES[tech_id]
        case.update(status="production", technicianId=tech_id, technician=name, startedAt=at,
                    startedTime=hm(hh, mm), updatedAt=at)
        case["workSessions"].append({
            "id": f"{case['id']}-W{len(case['workSessions']) + 1}", "startedAt": at, "startedTime": hm(hh, mm),
            "startedDate": d.isoformat(), "technicianId": tech_id, "technician": name, "overdue": case["wasOverdue"],
            "serviceTypes": list(case["serviceTypes"]), "arch": case["arch"], "scheduledDate": case["currentDueDate"],
            "source": "scan", "finishedAt": "",
        })
        case["history"].append({"at": at, "action": f"Moved to Production by {name}", "by": name})
        return case

    def finish(self, case, d, hh, mm, *, confirmed=True, include_in_routes=True):
        at, name, session = iso(d, hh, mm), case["technician"], case["workSessions"][-1]
        done = {"finishedAt": at, "finishedDate": d.isoformat(), "finishedTime": hm(hh, mm)}
        session.update(done, overdue=case["wasOverdue"])
        case.update(done, status="completed", finishedById=case["technicianId"], finishedBy=name,
                    overdue=case["wasOverdue"], updatedAt=at)
        case["history"].append({"at": at, "action": f"Completion submitted for Manager confirmation by {name}", "by": name})
        if not confirmed:
            session.update(completionReviewRequired=True, managerConfirmed=False)
            case.update(completionReviewRequired=True, completionReviewStatus="pending", completionRequestedAt=at,
                        completionRequestedById=case["technicianId"], completionRequestedBy=name)
            return case
        cd, ch, cm = shift(d, hh, mm, 20)
        c_at = iso(cd, ch, cm)
        confirmation = {"managerConfirmedAt": c_at, "managerConfirmedById": MANAGER[0], "managerConfirmedBy": MANAGER[1]}
        session.update(confirmation, completionReviewRequired=False, managerConfirmed=True)
        case.update(confirmation, completionReviewRequired=False, completionReviewStatus="confirmed", updatedAt=c_at)
        case["history"].append({"at": c_at, "action": "Completion confirmed by Manager", "by": MANAGER[1]})
        if include_in_routes:
            self.confirmed.append({"caseId": case["id"], "code": case["code"], "finishedDay": d, "confirmedAt": c_at})
        return case

    def reenter(self, case, due: date, received: date):
        at = iso(received, 9, 40)
        case.setdefault("reentryCycles", []).append({
            "scheduledDate": case["scheduledDate"], "originalScheduledDate": case["originalScheduledDate"],
            "currentDueDate": case["currentDueDate"], "overdue": case["overdue"], "status": case["status"],
            "finishedAt": case["finishedAt"], "arch": case["arch"], "serviceTypes": case["serviceTypes"], "archivedAt": at,
        })
        case.update(status="queue", scheduledDate=due.isoformat(), originalScheduledDate=due.isoformat(),
                    currentDueDate=due.isoformat(), missedScheduleDates={}, receivedDate=received.isoformat(),
                    receivedAt=at, receivedTime=at[11:16], overdue=False, wasOverdue=False, technicianId="",
                    technician="", startedAt="", startedTime="", finishedAt="", finishedDate="", finishedTime="",
                    finishedById="", finishedBy="", completionReviewStatus="", updatedAt=at)
        case["history"].append({"at": at, "action": f"Re-entered for {due.isoformat()}; previous cycle archived", "by": MANAGER[1]})
        return case

    def remove(self, case, d: date):
        at = iso(d, 8, 15)
        case.update(status="removed", removedFromQueue=True, queueRemovedAt=at, queueRemovedById=MANAGER[0],
                    queueRemovedBy=MANAGER[1], previousQueueStatus="queue", updatedAt=at)
        case["history"].append({"at": at, "action": "Removed from queue (previous status: queue)", "by": MANAGER[1]})
        return case

    def finalize(self) -> list[dict]:
        for case in self.items:
            if case["status"] in ("queue", "production") and case["overdue"]:
                case["overdueReasonRequired"] = bool(case["technicianId"] and not case["overdueReason"])
        return self.items
