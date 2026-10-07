"""Routes, stops, driver plans, public tracking links and email records for the demo."""
import hashlib
import random
from collections import defaultdict
from datetime import date, datetime, timedelta

from seed.calendar import next_production_day, prev_production_day
from seed.cases import iso
from seed.reference import CLINICS, COMPANY, DRIVERS, LAB_EIRCODE

CLINIC_BY_ID = {c[0]: c for c in CLINICS}
ACTIVE_CLINICS = [c[0] for c in CLINICS if c[4]]
DRIVER_UID = {d[0]: f"u-{d[0].lower()}" for d in DRIVERS}
WEEK_MS = 7 * 86_400_000


def tracking_token(*parts: str) -> str:
    return hashlib.sha256("|".join(parts).encode()).hexdigest()[:48]


def to_ms(value: str) -> int:
    return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() * 1000)


class RouteBook:
    def __init__(self):
        self.routes, self.stops, self.plans, self.emails, self.notifications = [], [], [], [], []

    def route(self, day: date, driver_id: str, status: str, *, created_at: str, started_at="", completed_at=""):
        rid = f"R{day.strftime('%Y%m%d')}-{len(self.routes) + 1:03d}"
        route = {"id": rid, "date": day.isoformat(), "driverId": driver_id, "driverUid": DRIVER_UID[driver_id],
                 "status": status, "startEircode": LAB_EIRCODE, "stopIds": [], "totalStops": 0, "trackingTokens": {},
                 "createdAt": created_at, "createdByUid": "u-mgr0001", "updatedAt": completed_at or started_at or created_at}
        if started_at:
            route["startedAt"] = started_at
        if completed_at:
            route["completedAt"] = completed_at
        self.routes.append(route)
        return route

    def stop(self, route, clinic_id, *, deliveries=(), collection=None, state="pending", at="", urgent=False):
        n = len(route["stopIds"]) + 1
        sid, done = f"{route['id']}-S{n:03d}", state == "completed"
        stop = {
            "id": sid, "routeId": route["id"], "clinicId": clinic_id, "order": n, "status": state,
            "arrived": state in ("arrived", "completed"), "deliveryCompleted": done, "collectionCompleted": done,
            "deliveries": [{"clinicId": clinic_id, "caseNumber": d["code"], "status": "pending",
                            "productionCaseId": d["caseId"], "productionConfirmedAt": d["confirmedAt"]} for d in deliveries],
            "collections": [] if collection is None else [{"clinicId": clinic_id, "notes": collection, "status": "pending"}],
            "createdAt": at if urgent else route["createdAt"],
        }
        if urgent:
            stop.update(urgent=True, addedAt=at)
        elif stop["arrived"]:
            stop["arrivedAt"] = at
        if done:
            stop["completedAt"] = at
        route["stopIds"].append(sid)
        route["totalStops"] = n
        route["trackingTokens"][sid] = tracking_token(sid, route["date"])
        self.stops.append(stop)
        return stop

    def plan(self, route, order: list[str], confirmed_at: str):
        self.plans.append({"id": route["id"], "routeId": route["id"], "driverUid": route["driverUid"],
                           "driverId": route["driverId"], "confirmed": True, "confirmedAt": confirmed_at, "version": 1,
                           "stopCount": len(order), "stopOrder": {sid: i + 1 for i, sid in enumerate(order)}})

    def email(self, route, stop, status: str, at: str):
        record = {"id": f"{route['id']}:{stop['id']}", "routeId": route["id"], "stopId": stop["id"], "status": status}
        record.update({"sentAt": at} if status == "sent" else {"updatedAt": at, "error": "Email provider error"})
        self.emails.append(record)


def past_routes(book: RouteBook, confirmed: list[dict], route_today: date, rng: random.Random) -> None:
    by_day = defaultdict(list)
    for item in confirmed:
        day = next_production_day(item["finishedDay"] + timedelta(days=1))
        if day < route_today:
            by_day[day].append(item)
    for i, day in enumerate(sorted(by_day)):
        items = by_day[day]
        drivers = ["D0001", "D0002"] if len(items) > 4 else [("D0001", "D0002")[i % 2]]
        for k, driver in enumerate(drivers):
            route = book.route(day, driver, "completed", created_at=iso(prev_production_day(day), 16, 0),
                               started_at=iso(day, 9, 30), completed_at=iso(day, 15, 40))
            per_clinic = defaultdict(list)
            for item in items[k::len(drivers)]:
                per_clinic[rng.choice(ACTIVE_CLINICS)].append(item)
            collect = rng.choice(ACTIVE_CLINICS)
            for j, (clinic_id, deliveries) in enumerate(sorted(per_clinic.items())):
                book.stop(route, clinic_id, deliveries=deliveries, collection="Return box" if clinic_id == collect else None,
                          state="completed", at=iso(day, 10 + j, 15))
            if collect not in per_clinic:
                book.stop(route, collect, collection="Impressions pick-up", state="completed", at=iso(day, 14, 50))
            order = list(route["stopIds"])
            rng.shuffle(order)
            book.plan(route, order, iso(day, 9, 10))
            for stop in book.stops[-len(route["stopIds"]):]:
                if CLINIC_BY_ID[stop["clinicId"]][6][0]:
                    book.email(route, stop, "sent", iso(day, 9, 25))


def current_routes(book: RouteBook, confirmed: list[dict], route_today: date) -> None:
    ready = {c["code"]: c for c in confirmed if next_production_day(c["finishedDay"] + timedelta(days=1)) == route_today}
    created = iso(prev_production_day(route_today), 16, 30)

    started = book.route(route_today, "D0001", "started", created_at=created, started_at=iso(route_today, 9, 20))
    s1 = book.stop(started, "C0001", deliveries=[ready["4107"]], collection="Two repairs boxed at reception",
                   state="completed", at=iso(route_today, 9, 55))
    s2 = book.stop(started, "C0003", deliveries=[ready["5207"]], state="arrived", at=iso(route_today, 10, 40))
    s3 = book.stop(started, "C0004", collection="Impressions for upper prosthesis")
    s4 = book.stop(started, "C0007", deliveries=[ready["6305"]])
    s5 = book.stop(started, "C0005", collection="Urgent repair pick-up", urgent=True, at=iso(route_today, 10, 5))
    book.plan(started, [s1["id"], s2["id"], s4["id"], s3["id"]], iso(route_today, 9, 10))
    book.email(started, s1, "sent", iso(route_today, 9, 15))
    book.email(started, s2, "sent", iso(route_today, 9, 15))
    book.email(started, s3, "failed", iso(route_today, 9, 15))
    book.notifications.append({
        "id": "N0001", "driverUid": started["driverUid"], "routeId": started["id"], "stopId": s5["id"], "clinicId": "C0005",
        "message": "New stop added: Swords Dental Clinic. Choose its position in your remaining route.",
        "createdAt": iso(route_today, 10, 5), "read": False, "type": "urgent_stop",
    })

    published = book.route(route_today, "D0002", "published", created_at=created)
    book.stop(published, "C0002", deliveries=[ready["4112"]], collection="")
    book.stop(published, "C0006", collection="Return articulator")
    book.stop(published, "C0001", collection="Impressions for new upper prosthesis")

    tomorrow = next_production_day(route_today + timedelta(days=1))
    upcoming = book.route(tomorrow, "D0001", "published", created_at=iso(route_today, 11, 0))
    book.stop(upcoming, "C0006", collection="Weekly collection")
    book.stop(upcoming, "C0002", collection="")


def ordered_stop_ids(route: dict, plan: dict | None) -> list[str]:
    if not plan or not plan.get("confirmed"):
        return list(route["stopIds"])
    planned = [sid for sid, _ in sorted(plan["stopOrder"].items(), key=lambda x: x[1]) if sid in route["stopIds"]]
    return planned + [sid for sid in route["stopIds"] if sid not in planned]


def tracking_status(route: dict, stop: dict, current: dict | None) -> str:
    if stop["status"] == "completed" or route["status"] == "completed":
        return "completed"
    if stop["arrived"]:
        return "arrived"
    if route["status"] == "break":
        return "break"
    if current and current["id"] == stop["id"] and route["status"] == "started":
        return "approaching"
    return "started" if route["status"] == "started" else "scheduled"


def public_tracking(book: RouteBook, now_ms: int) -> list[dict]:
    stops = {s["id"]: s for s in book.stops}
    plans = {p["routeId"]: p for p in book.plans}
    docs = []
    for route in book.routes:
        plan = plans.get(route["id"])
        ordered = [stops[sid] for sid in ordered_stop_ids(route, plan)]
        current = next((s for s in ordered if s["status"] != "completed"), None)
        completed = sum(1 for s in ordered if s["status"] == "completed")
        expires = to_ms(route["createdAt"]) + WEEK_MS
        for idx, stop in enumerate(ordered):
            status, clinic = tracking_status(route, stop, current), CLINIC_BY_ID[stop["clinicId"]]
            unplaced = stop.get("urgent") and plan and stop["id"] not in plan["stopOrder"]
            eta = ("" if status == "completed" else "Available when route starts" if route["status"] == "published"
                   else "Waiting for driver to place this stop" if unplaced else "Updating with route progress")
            doc = {
                "id": route["trackingTokens"][stop["id"]], "active": True, "routeId": route["id"], "stopId": stop["id"],
                "clinicName": clinic[1], "routeDate": route["date"], "status": status,
                "deliveryCases": [d["caseNumber"] for d in stop["deliveries"]], "hasCollection": bool(stop["collections"]),
                "totalStops": len(ordered), "completedStops": completed,
                "stopsRemaining": sum(1 for s in ordered[:idx] if s["status"] != "completed"), "etaText": eta,
                "companyName": COMPANY, "completedAt": stop.get("completedAt", ""), "updatedAt": route["updatedAt"],
                "expiresAtMs": expires, "expiresAt": datetime.fromtimestamp(expires / 1000).isoformat(),
            }
            if current and stop["id"] == current["id"] and route["status"] == "started":
                lat, lng = clinic[5]
                doc.update(driverLat=lat + 0.004, driverLng=lng - 0.006, driverAccuracy=18, locationUpdatedAt=now_ms)
            docs.append(doc)
    return docs


def build_routes(confirmed: list[dict], route_today: date, rng: random.Random) -> RouteBook:
    book = RouteBook()
    past_routes(book, confirmed, route_today, rng)
    if confirmed:
        current_routes(book, confirmed, route_today)
    return book
