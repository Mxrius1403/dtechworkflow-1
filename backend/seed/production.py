"""Unassigned production cases for the demo."""
from datetime import date, timedelta

from seed.calendar import next_production_day
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


def build_cases(today: date) -> CaseBook:
    book = CaseBook(today)
    explicit_cases(book, today)
    book.finalize()
    return book
