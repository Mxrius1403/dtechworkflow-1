"""Irish public holidays and production-day rules (mirrors frontend/src/lib/holidays.js)."""
from datetime import date, timedelta
from functools import lru_cache


def easter_sunday(year: int) -> date:
    a, b, c = year % 19, year // 100, year % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = (h + l - 7 * m + 114) % 31 + 1
    return date(year, month, day)


def first_monday(year: int, month: int) -> date:
    d = date(year, month, 1)
    return d + timedelta(days=(0 - d.weekday()) % 7)


def last_monday(year: int, month: int) -> date:
    d = (date(year, month + 1, 1) if month < 12 else date(year + 1, 1, 1)) - timedelta(days=1)
    return d - timedelta(days=d.weekday())


@lru_cache(maxsize=16)
def irish_public_holidays(year: int) -> dict[date, str]:
    feb1 = date(year, 2, 1)
    return {
        date(year, 1, 1): "New Year's Day",
        feb1 if feb1.weekday() == 4 else first_monday(year, 2): "St Brigid's Day",
        date(year, 3, 17): "St Patrick's Day",
        easter_sunday(year) + timedelta(days=1): "Easter Monday",
        first_monday(year, 5): "May Public Holiday",
        first_monday(year, 6): "June Public Holiday",
        first_monday(year, 8): "August Public Holiday",
        last_monday(year, 10): "October Public Holiday",
        date(year, 12, 25): "Christmas Day",
        date(year, 12, 26): "St Stephen's Day",
    }


def is_production_day(d: date) -> bool:
    return d.weekday() < 5 and d not in irish_public_holidays(d.year)


def next_production_day(d: date) -> date:
    while not is_production_day(d):
        d += timedelta(days=1)
    return d


def prev_production_day(d: date) -> date:
    d -= timedelta(days=1)
    while not is_production_day(d):
        d -= timedelta(days=1)
    return d


def production_days_back(d: date, count: int) -> list[date]:
    days = []
    for _ in range(count):
        d = prev_production_day(d)
        days.append(d)
    return days


def working_days_between(start: date, end: date) -> int:
    return sum(1 for n in range((end - start).days + 1) if is_production_day(start + timedelta(days=n)))
