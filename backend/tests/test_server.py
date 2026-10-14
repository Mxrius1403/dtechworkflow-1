import asyncio

import pytest
from fastapi import Request, Response

from server import (
    app,
    disable_api_caching,
    ensure_auth_email_index,
    health,
    protect_state_changing_requests,
)


def test_tooth_order_routes_are_registered():
    routes = {
        (route.path, method)
        for route in app.routes
        for method in getattr(route, "methods", set())
    }

    assert ("/api/tooth-orders", "POST") in routes
    assert ("/api/tooth-orders/{order_id}/status", "PATCH") in routes
    assert ("/api/tooth-orders/{order_id}", "DELETE") in routes


def test_public_tracking_route_is_not_registered():
    routes = {
        (route.path, method)
        for route in app.routes
        for method in getattr(route, "methods", set())
    }

    assert not any(path.startswith("/api/tracking/") for path, _ in routes)


def test_health_only_reports_service_status():
    assert asyncio.run(health()) == {"status": "ok"}


@pytest.mark.parametrize(
    ("headers", "expected_status"),
    [
        ([], 403),
        ([(b"origin", b"https://attacker.example")], 403),
        ([(b"origin", b"http://localhost:3000")], 204),
        ([(b"referer", b"http://localhost:3000/setup")], 204),
    ],
)
def test_state_changing_requests_reject_missing_or_untrusted_origin(
    headers, expected_status
):
    request = Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": "/api/cases",
            "raw_path": b"/api/cases",
            "query_string": b"",
            "headers": headers,
            "server": ("testserver", 80),
            "client": ("127.0.0.1", 1234),
        }
    )

    async def next_handler(_request):
        return Response(status_code=204)

    response = asyncio.run(protect_state_changing_requests(request, next_handler))

    assert response.status_code == expected_status


@pytest.mark.parametrize(
    ("path", "expected"),
    [("/api/data", "no-store"), ("/api/changes", "no-store"), ("/index.html", None)],
)
def test_api_responses_are_never_cached(path, expected):
    request = Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "GET",
            "scheme": "http",
            "path": path,
            "raw_path": path.encode(),
            "query_string": b"",
            "headers": [],
            "server": ("testserver", 80),
            "client": ("127.0.0.1", 1234),
        }
    )

    async def next_handler(_request):
        return Response(status_code=200)

    response = asyncio.run(disable_api_caching(request, next_handler))

    assert response.headers.get("cache-control") == expected


def test_auth_email_index_migrates_legacy_unique_index(monkeypatch):
    class Collection:
        def __init__(self):
            self.dropped_indexes = []
            self.created_indexes = []

        async def index_information(self):
            return {
                "_id_": {"key": [("_id", 1)]},
                "email_1": {"key": [("email", 1)], "unique": True},
            }

        async def drop_index(self, name):
            self.dropped_indexes.append(name)

        async def create_index(self, field, **options):
            self.created_indexes.append((field, options))

    collection = Collection()

    class Database:
        def __getitem__(self, name):
            assert name == "auth_users"
            return collection

    monkeypatch.setattr("server.db", Database())

    asyncio.run(ensure_auth_email_index())

    assert collection.dropped_indexes == ["email_1"]
    assert collection.created_indexes == [
        (
            "email",
            {
                "unique": True,
                "partialFilterExpression": {"email": {"$type": "string"}},
            },
        )
    ]


def test_auth_email_index_keeps_existing_partial_unique_index(monkeypatch):
    class Collection:
        def __init__(self):
            self.dropped_indexes = []
            self.created_indexes = []

        async def index_information(self):
            return {
                "email_1": {
                    "key": [("email", 1)],
                    "unique": True,
                    "partialFilterExpression": {"email": {"$type": "string"}},
                }
            }

        async def drop_index(self, name):
            self.dropped_indexes.append(name)

        async def create_index(self, field, **options):
            self.created_indexes.append((field, options))

    collection = Collection()

    class Database:
        def __getitem__(self, name):
            assert name == "auth_users"
            return collection

    monkeypatch.setattr("server.db", Database())

    asyncio.run(ensure_auth_email_index())

    assert collection.dropped_indexes == []
    assert len(collection.created_indexes) == 1
