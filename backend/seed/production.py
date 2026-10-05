"""Production cases for the demo: explicit scenarios for today plus generated history for reports."""
import random
from datetime import date, timedelta

from seed.calendar import next_production_day, production_days_back
from seed.cases import CaseBook, shift
from seed.reference import ARCH_OPTIONS, OVERDUE_REASONS, SERVICE_TYPES, STAFF

TECHS = [(sid, dept) for sid, _, role, dept, active in STAFF if role == "technician" and active]


def explicit_cases(book: CaseBook, today: date) -> None:
    """Hand-written scenarios so every dashboard, list and status has something to show."""
    p1, p2, p3, p6 = (production_days_back(today, 6)[i] for i in (0, 1, 2, 5))
    n1 = next_production_day(today + timedelta(days=1))
    n2 = next_production_day(n1 + timedelta(days=1))
    add, start, finish = book.add, book.start, book.finish

    # Denture
    add("4101", "denture", today, types=["Repair"], arch="Upper")
    add("4102", "denture", today, types=["Addition", "Bite"], arch="Lower", attention="on_hold",
        note="Awaiting shade confirmation from clinic")
    start(add("4103", "denture", today, types=["Finish"], arch="Upper & Lower"), "DT001", today, 8, 40)
    late = book.overdue(add("4104", "denture", p2, types=["Special Tray"], arch="Upper"), p2)
    start(late, "DT002", p1, 10, 15)
    finish(start(add("4105", "denture", today, types=["Try In"], arch="Lower"), "DT001", today, 8, 5), today, 9, 20, confirmed=False)
    finish(start(add("4106", "denture", today, types=["Repair"], arch="Upper"), "DT002", today, 8, 10), today, 9, 5)
    finish(start(add("4107", "denture", p1, types=["Addition"], arch="Lower"), "DT001", p1, 9, 30), p1, 11, 10)
    finish(start(add("4112", "denture", p1, types=["Bite"], arch="Upper"), "DT002", p1, 13, 0), p1, 14, 25)
    add("4108", "denture", n1, types=["Bite"], arch="Upper")
    add("4109", "denture", today, types=["Special Tray"], arch="Upper & Lower", attention="need_information",
        note="Missing prescription details from clinic")
    book.remove(add("4110", "denture", today, types=["Repair"], arch="Lower"), today)
    cycle = finish(start(add("4111", "denture", p6, types=["Repair"], arch="Upper"), "DT001", p6, 10, 0), p6, 11, 15)
    book.reenter(cycle, today, p1)

    # Ortho
    add("5201", "ortho", today)
    start(add("5202", "ortho", today), "DT003", today, 9, 15)
    start(book.overdue(add("5203", "ortho", p3), p3, reason="Waiting for retainer wire stock"), "DT004", p2, 11, 0)
    finish(start(add("5204", "ortho", today), "DT003", today, 8, 0), today, 8, 55)
    finish(start(add("5205", "ortho", today), "DT004", today, 8, 20), today, 9, 40, confirmed=False)
    add("5206", "ortho", n2)
    finish(start(add("5207", "ortho", p1), "DT003", p1, 10, 0), p1, 12, 0)

    # Digital
    add("6301", "digital", today)
    start(add("6302", "digital", today), "DT005", today, 8, 30)
    finish(start(add("6303", "digital", today), "DT005", today, 7, 50), today, 8, 25)
    add("6304", "digital", n1, attention="on_hold", note="Scan file corrupted — clinic re-sending")
    finish(start(add("6305", "digital", p1), "DT005", p1, 14, 0), p1, 15, 10)
    book.overdue(add("6306", "digital", p1), p1)
    finish(start(add("DG-77", "digital", today), "DT005", today, 7, 30), today, 7, 45)


def historical_cases(book: CaseBook, today: date, rng: random.Random) -> None:
    """Completed, manager-confirmed cycles over the previous working days (feeds reports & past routes)."""
    used = {c["code"] for c in book.items}
    for day in production_days_back(today, 14)[1:]:
        for tech, dept in TECHS:
            for _ in range(rng.choice([0, 1, 1, 2])):
                code = str(rng.randint(1000, 9999))
                while code in used:
                    code = str(rng.randint(1000, 9999))
                used.add(code)
                late = rng.random() < 0.18
                due = production_days_back(day, 1)[0] if late else day
                denture = dept == "denture"
                case = book.add(code, dept, due, types=rng.sample(SERVICE_TYPES, rng.choice([1, 1, 2])) if denture else (),
                                arch=rng.choice(ARCH_OPTIONS) if denture else "")
                if late:
                    book.overdue(case, due, until=day, reason=rng.choice(OVERDUE_REASONS) if rng.random() < 0.7 else "")
                hh, mm = rng.randint(8, 13), rng.choice([0, 10, 15, 20, 30, 40, 45, 50])
                book.start(case, tech, day, hh, mm)
                book.finish(case, *shift(day, hh, mm, rng.randint(25, 210)))


def build_cases(today: date, rng: random.Random) -> CaseBook:
    book = CaseBook(today)
    explicit_cases(book, today)
    historical_cases(book, today, rng)
    book.finalize()
    return book
