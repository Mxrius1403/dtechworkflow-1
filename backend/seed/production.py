"""Production cases for the demo, including a broad workflow test matrix."""
from datetime import date, datetime, timedelta

from seed.calendar import next_production_day, prev_production_day
from seed.cases import CaseBook


def explicit_cases(book: CaseBook, today: date) -> None:
    """Hand-written queue scenarios for the demo."""
    n1 = next_production_day(today + timedelta(days=1))
    n2 = next_production_day(n1 + timedelta(days=1))
    add = book.add

    # Prosthesis
    add("4101", "prosthesis", today, types=["Repair"], arch="Upper")
    add("4102", "prosthesis", today, types=["Addition", "Bite"], arch="Lower", attention="on_hold",
        note="Awaiting shade confirmation from clinic")
    add("4108", "prosthesis", n1, types=["Bite"], arch="Upper")
    add("4109", "prosthesis", today, types=["Special Tray"], arch="Upper & Lower", attention="need_information",
        note="Missing prescription details from clinic")
    book.remove(add("4110", "prosthesis", today, types=["Repair"], arch="Lower"), today)

    # Ortho
    add("5201", "ortho", today)
    add("5206", "ortho", n2)

    # Digital
    add("6301", "digital", today)
    add("6304", "digital", n1, attention="on_hold", note="Scan file corrupted — clinic re-sending")
    book.overdue(add("6306", "digital", today), today)


def workflow_test_cases(book: CaseBook, today: date) -> None:
    """Add 90 cases to bring the complete demo dataset to exactly 100."""
    departments = ("prosthesis", "ortho", "digital")
    statuses = ("queue", "production", "completed", "removed")
    attention_statuses = ("active", "on_hold", "need_information")
    service_types = ("Repair", "Addition", "Bite", "Special Tray", "Finish", "Try In")
    arches = ("Upper", "Lower", "Upper & Lower")
    production_date = next_production_day(today)
    recent_work_date = prev_production_day(today - timedelta(days=2))
    old_work_date = prev_production_day(today - timedelta(days=12))

    for index in range(90):
        department = departments[index % len(departments)]
        workflow_status = statuses[(index // len(departments)) % len(statuses)]
        attention_status = attention_statuses[(index // 12) % len(attention_statuses)]
        overdue = index // 36 == 1
        number = 7001 + index

        if department == "prosthesis":
            mask = index // len(departments) % ((1 << len(service_types)) - 1) + 1
            types = [
                service
                for bit, service in enumerate(service_types)
                if mask & (1 << bit)
            ]
            arch = arches[(index // (len(departments) * 4)) % len(arches)]
        else:
            types, arch = [], ""

        note = {
            "active": "",
            "on_hold": "Demo scenario: waiting for clinic response",
            "need_information": "Demo scenario: information required",
        }[attention_status]
        case = book.add(
            str(number),
            department,
            production_date,
            types=types,
            arch=arch,
            attention=attention_status,
            note=note,
        )

        work_date = (
            old_work_date
            if workflow_status == "completed" and index % 3 == 0
            else recent_work_date
        )
        if overdue:
            book.overdue(case, work_date - timedelta(days=2), until=work_date)

        if workflow_status == "queue":
            continue
        if workflow_status == "removed":
            book.remove(case, today)
            continue

        technician_id = f"DEMO-TECH-{index % 3 + 1}"
        book.start(case, technician_id, work_date, 9, index % 60)
        if workflow_status == "production":
            continue

        confirmed = index % 4 != 0
        book.finish(
            case,
            work_date,
            15,
            index % 60,
            confirmed=confirmed,
            include_in_routes=False,
        )


def build_cases(today: date) -> CaseBook:
    book = CaseBook(today)
    explicit_cases(book, today)
    workflow_test_cases(book, today)
    if len(book.items) != 100:
        raise ValueError(f"Expected exactly 100 demo cases, got {len(book.items)}.")
    book.finalize()
    return book
