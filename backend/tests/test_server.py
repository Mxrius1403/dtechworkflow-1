import asyncio

from server import app, ensure_auth_email_index, health


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
