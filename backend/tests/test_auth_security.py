import asyncio

import pytest
from core import security
from fastapi import HTTPException, Response
from pydantic import ValidationError
from routers import auth, data
from routers.auth import (
    LoginRequest,
    ManagerCreate,
    ManagerStatusUpdate,
    ManagerUpdate,
    OwnerSetup,
    OwnershipTransfer,
    TechnicianCreate,
    TechnicianStatusUpdate,
    TechnicianUpdate,
)
from starlette.requests import Request


def test_password_hash_is_verified_without_storing_plaintext():
    password = "correct-horse-battery-staple"
    stored_hash = security.hash_password(password)

    assert stored_hash != password
    assert security.verify_password(password, stored_hash)
    assert not security.verify_password("incorrect-password", stored_hash)


def test_bcrypt_password_byte_limit_is_enforced():
    with pytest.raises(ValueError, match="72 UTF-8 bytes"):
        security.hash_password("a" * 73)
    assert not security.verify_password("a" * 73, security._DUMMY_PASSWORD_HASH)


def test_session_token_round_trips_and_rejects_tampering(monkeypatch):
    monkeypatch.setattr(security, "AUTH_SECRET_KEY", "s" * 48)
    token = security.create_session_token("DT006", 4)

    assert security.decode_session_token(token)["sub"] == "DT006"
    assert security.decode_session_token(token)["ver"] == 4
    assert security.decode_session_token(f"{token}tampered") is None


def test_session_token_rejects_wrong_secret(monkeypatch):
    monkeypatch.setattr(
        security, "AUTH_SECRET_KEY", "first-secret-value-that-is-long-enough"
    )
    token = security.create_session_token("OWNER001", 0)
    monkeypatch.setattr(
        security, "AUTH_SECRET_KEY", "second-secret-value-that-is-long-enough"
    )

    assert security.decode_session_token(token) is None


def test_auth_configuration_rejects_weak_key_and_wildcard_origin(monkeypatch):
    monkeypatch.setattr(security, "AUTH_SECRET_KEY", "short")
    monkeypatch.setattr(security, "CORS_ORIGINS", ["http://localhost:3000"])
    with pytest.raises(RuntimeError, match="32 bytes"):
        security.validate_security_config()

    monkeypatch.setattr(security, "AUTH_SECRET_KEY", "s" * 48)
    monkeypatch.setattr(security, "CORS_ORIGINS", ["*"])
    with pytest.raises(RuntimeError, match="explicit frontend origins"):
        security.validate_security_config()


def test_technician_credentials_and_department_assignment_are_validated():
    with pytest.raises(ValidationError):
        TechnicianCreate(
            name="New Tech",
            email="tech@example.com",
            password="short",
        )
    with pytest.raises(ValidationError):
        TechnicianCreate(
            name="New Tech",
            email="tech@example.com",
            password="long-enough-password",
            department="owner",
        )
    assert (
        LoginRequest(email="owner@example.com", password="secret").email
        == "owner@example.com"
    )


def test_manager_credentials_are_independent_of_technician_department():
    manager = ManagerCreate(
        name="Lab Manager",
        email="manager@example.com",
        password="long-enough-password",
    )

    assert manager.name == "Lab Manager"
    assert not hasattr(manager, "department")
    assert OwnershipTransfer(managerId="MGR0001").manager_id == "MGR0001"


def test_owner_setup_creates_first_owner_and_signs_them_in(monkeypatch):
    class Collection:
        account = None

        async def find_one(self, _query, _projection=None):
            return self.account

        async def insert_one(self, account):
            if self.account:
                raise auth.DuplicateKeyError("owner already exists")
            self.account = account

    class Database:
        def __init__(self):
            self.collection = Collection()

        def __getitem__(self, _name):
            return self.collection

    database = Database()
    monkeypatch.setattr(auth, "db", database)
    monkeypatch.setattr(auth, "create_session_token", lambda user_id, version: "token")
    assert asyncio.run(auth.get_setup_status()) == {"required": True}

    response = Response()
    result = asyncio.run(
        auth.setup_owner(
            OwnerSetup(
                name=" Owner ",
                email="owner@example.com",
                password="long-enough-password",
            ),
            response,
        )
    )

    assert database.collection.account["authVersion"] == 0
    assert database.collection.account["role"] == "owner"
    assert database.collection.account["name"] == "Owner"
    assert security.verify_password(
        "long-enough-password", database.collection.account["passwordHash"]
    )
    assert result["user"]["id"] == "OWNER001"
    assert "dt_session=token" in response.headers["set-cookie"]
    assert asyncio.run(auth.get_setup_status()) == {"required": False}


def test_owner_creates_manager_as_separate_login_role(monkeypatch):
    class Collection:
        account = None

        async def find(self, _query, _projection=None):
            return self

        async def to_list(self, _limit):
            return [{"_id": "OWNER001"}]

        async def insert_one(self, account):
            self.account = account

    class Database:
        def __init__(self):
            self.collection = Collection()

        def __getitem__(self, _name):
            return self.collection

    database = Database()
    monkeypatch.setattr(auth, "db", database)
    monkeypatch.setattr(auth, "allocate_manager_id", lambda: asyncio.sleep(0, result="MGR0001"))

    result = asyncio.run(
        auth.create_manager(
            ManagerCreate(
                name=" Manager ",
                email="manager@example.com",
                password="long-enough-password",
            ),
            {"_id": "OWNER001"},
        )
    )

    account = database.collection.account
    assert account["_id"] == "MGR0001"
    assert account["name"] == "Manager"
    assert account["role"] == "manager"
    assert account["department"] is None
    assert account["createdBy"] == "OWNER001"
    assert security.verify_password("long-enough-password", account["passwordHash"])
    assert result["user"]["isManager"] is True
    assert result["user"]["isOwner"] is False


def test_manager_can_create_technician_account(monkeypatch):
    class Collection:
        account = None

        async def insert_one(self, account):
            self.account = account

    class Database:
        def __init__(self):
            self.collection = Collection()

        def __getitem__(self, _name):
            return self.collection

    database = Database()
    monkeypatch.setattr(auth, "db", database)
    monkeypatch.setattr(
        auth, "allocate_technician_id", lambda: asyncio.sleep(0, result="DT001")
    )

    result = asyncio.run(
        auth.create_technician(
            TechnicianCreate(
                name="New Technician",
                email="tech@example.com",
                password="long-enough-password",
            ),
            {"_id": "MGR0001", "role": "manager"},
        )
    )

    account = database.collection.account
    assert account["_id"] == "DT001"
    assert account["role"] == "technician"
    assert "department" not in account
    assert account["createdBy"] == "MGR0001"
    assert result["user"]["id"] == "DT001"
    assert result["user"]["department"] is None


def test_technician_creation_allows_managers_and_owners_only():
    check_role = security.require_roles("owner", "manager")
    assert asyncio.run(check_role({"role": "manager"}))["role"] == "manager"
    assert asyncio.run(check_role({"role": "owner"}))["role"] == "owner"

    with pytest.raises(HTTPException) as error:
        asyncio.run(check_role({"role": "technician"}))
    assert error.value.status_code == 403


def test_manager_can_toggle_technician_sign_in_and_archive_without_deleting_history(
    monkeypatch,
):
    account = {
        "_id": "DT001",
        "name": "Former Technician",
        "email": "tech@example.com",
        "passwordHash": "stored-hash",
        "role": "technician",
        "active": True,
        "authVersion": 0,
    }
    history = [{"technicianId": "DT001", "technician": "Former Technician"}]

    class Collection:
        async def update_one(self, query, update):
            assert query["_id"] == "DT001"
            if "active" in query and query["active"] != account["active"]:
                return type("Result", (), {"matched_count": 0})()
            if "$set" in update:
                account.update(update["$set"])
            for field in update.get("$unset", {}):
                account.pop(field, None)
            if "$inc" in update:
                for field, amount in update["$inc"].items():
                    account[field] = account.get(field, 0) + amount
            return type("Result", (), {"matched_count": 1})()

        async def find_one(self, query, _projection=None):
            return account if query.get("_id") == account["_id"] else None

    class Database:
        def __getitem__(self, name):
            assert name == "auth_users"
            return Collection()

    monkeypatch.setattr(auth, "db", Database())
    manager = {"_id": "MGR0001", "role": "manager"}

    result = asyncio.run(
        auth.update_technician_status(
            "DT001", TechnicianStatusUpdate(active=False), manager
        )
    )
    assert account["active"] is False
    assert account["authVersion"] == 1
    assert result["user"]["active"] is False

    result = asyncio.run(auth.delete_technician("DT001", manager))

    assert result == {"id": "DT001", "deleted": True}
    assert account["deleted"] is True
    assert account["active"] is False
    assert account["authVersion"] == 2
    assert account["name"] == "Former Technician"
    assert account["_id"] == "DT001"
    assert "email" not in account
    assert "passwordHash" not in account
    assert history == [{"technicianId": "DT001", "technician": "Former Technician"}]


def test_manager_can_update_technician_name_and_email_and_revoke_sessions(monkeypatch):
    account = {
        "_id": "DT001",
        "name": "Old Name",
        "email": "old@example.com",
        "role": "technician",
        "active": True,
        "authVersion": 0,
    }

    class Collection:
        async def update_one(self, query, update):
            assert query == {
                "_id": "DT001",
                "role": "technician",
                "deleted": {"$ne": True},
            }
            account.update(update["$set"])
            account["authVersion"] += update["$inc"]["authVersion"]
            return type("Result", (), {"matched_count": 1})()

        async def find_one(self, _query):
            return account

    class Database:
        def __getitem__(self, name):
            assert name == "auth_users"
            return Collection()

    monkeypatch.setattr(auth, "db", Database())
    result = asyncio.run(
        auth.update_technician_profile(
            "DT001",
            TechnicianUpdate(name="  New Name  ", email="NEW@example.com"),
            {"_id": "MGR0001", "role": "manager"},
        )
    )

    assert account["name"] == "New Name"
    assert account["email"] == "new@example.com"
    assert account["authVersion"] == 1
    assert result["user"]["name"] == "New Name"
    assert result["user"]["email"] == "new@example.com"


def test_manager_can_change_technician_password_and_revoke_sessions(monkeypatch):
    new_password = "a-new-long-enough-password"
    account = {
        "_id": "DT001",
        "name": "Technician",
        "email": "tech@example.com",
        "passwordHash": security.hash_password("old-long-enough-password"),
        "role": "technician",
        "active": True,
        "authVersion": 0,
    }

    class Collection:
        async def update_one(self, _query, update):
            account.update(update["$set"])
            account["authVersion"] += update["$inc"]["authVersion"]
            return type("Result", (), {"matched_count": 1})()

        async def find_one(self, _query):
            return account

    class Database:
        def __getitem__(self, name):
            assert name == "auth_users"
            return Collection()

    monkeypatch.setattr(auth, "db", Database())
    result = asyncio.run(
        auth.update_technician_profile(
            "DT001",
            TechnicianUpdate(
                name="Technician",
                email="tech@example.com",
                password=new_password,
            ),
            {"_id": "MGR0001", "role": "manager"},
        )
    )

    assert account["authVersion"] == 1
    assert security.verify_password(new_password, account["passwordHash"])
    assert not security.verify_password(
        "old-long-enough-password", account["passwordHash"]
    )
    assert result["user"]["id"] == "DT001"


def test_technician_profile_update_rejects_duplicate_email(monkeypatch):
    class Collection:
        async def update_one(self, _query, _update):
            raise auth.DuplicateKeyError("duplicate email")

    class Database:
        def __getitem__(self, _name):
            return Collection()

    monkeypatch.setattr(auth, "db", Database())
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            auth.update_technician_profile(
                "DT001",
                TechnicianUpdate(name="New Name", email="used@example.com"),
                {"_id": "MGR0001", "role": "manager"},
            )
        )

    assert error.value.status_code == 409
    assert error.value.detail == "An account with this email already exists."


def test_technician_emails_are_only_included_for_managers(monkeypatch):
    accounts = [
        {
            "_id": "DT001",
            "name": "Active Technician",
            "email": "active@example.com",
            "role": "technician",
            "active": True,
            "createdAt": "2026-01-01",
        },
        {
            "_id": "DT002",
            "name": "Archived Technician",
            "role": "technician",
            "active": False,
            "createdAt": "2026-01-01",
            "deleted": True,
        },
    ]

    class Cursor:
        def __init__(self, rows):
            self.rows = rows

        async def to_list(self, _limit):
            return self.rows

    class Collection:
        def __init__(self, rows):
            self.rows = rows

        def find(self, *_args, **_kwargs):
            return Cursor(self.rows)

    class Database:
        def __getitem__(self, name):
            return Collection(accounts if name == "auth_users" else [])

    monkeypatch.setattr(data, "db", Database())
    manager_rows = asyncio.run(data.read_collection("users", include_login_email=True))
    technician_rows = asyncio.run(data.read_collection("users"))

    assert manager_rows[0]["email"] == "active@example.com"
    assert "email" not in manager_rows[1]
    assert all("email" not in row for row in technician_rows)


def test_active_technician_cannot_be_deleted(monkeypatch):
    account = {"_id": "DT001", "role": "technician", "active": True}

    class Collection:
        async def update_one(self, _query, _update):
            return type("Result", (), {"matched_count": 0})()

        async def find_one(self, _query):
            return account

    class Database:
        def __getitem__(self, _name):
            return Collection()

    monkeypatch.setattr(auth, "db", Database())
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            auth.delete_technician(
                "DT001", {"_id": "MGR0001", "role": "manager"}
            )
        )

    assert error.value.status_code == 409
    assert account["active"] is True
    assert "deleted" not in account


def test_owner_can_deactivate_manager_and_invalidate_sessions(monkeypatch):
    account = {
        "_id": "MGR0001",
        "name": "Manager",
        "email": "manager@example.com",
        "role": "manager",
        "department": None,
        "active": True,
        "authVersion": 2,
    }

    class Collection:
        async def update_one(self, query, update):
            assert query == {
                "_id": "MGR0001",
                "role": "manager",
                "deleted": {"$ne": True},
            }
            account.update(update["$set"])
            account["authVersion"] += update["$inc"]["authVersion"]
            return type("Result", (), {"matched_count": 1})()

        async def find_one(self, _query):
            return account

    class Database:
        def __getitem__(self, _name):
            return Collection()

    monkeypatch.setattr(auth, "db", Database())
    result = asyncio.run(
        auth.update_manager_status(
            "MGR0001",
            ManagerStatusUpdate(active=False),
            {"_id": "OWNER001", "role": "owner"},
        )
    )

    assert account["active"] is False
    assert account["authVersion"] == 3
    assert result["user"]["active"] is False


def test_owner_can_update_manager_profile_and_revoke_sessions(monkeypatch):
    new_password = "a-new-long-enough-password"
    account = {
        "_id": "MGR0001",
        "name": "Old Name",
        "email": "old@example.com",
        "passwordHash": security.hash_password("old-long-enough-password"),
        "role": "manager",
        "active": True,
        "authVersion": 3,
    }

    class Collection:
        async def update_one(self, query, update):
            assert query == {
                "_id": "MGR0001",
                "role": "manager",
                "deleted": {"$ne": True},
            }
            account.update(update["$set"])
            account["authVersion"] += update["$inc"]["authVersion"]
            return type("Result", (), {"matched_count": 1})()

        async def find_one(self, _query):
            return account

    class Database:
        def __getitem__(self, name):
            assert name == "auth_users"
            return Collection()

    monkeypatch.setattr(auth, "db", Database())
    result = asyncio.run(
        auth.update_manager_profile(
            "MGR0001",
            ManagerUpdate(
                name="  New Name  ",
                email="NEW@example.com",
                password=new_password,
            ),
            {"_id": "OWNER001", "role": "owner"},
        )
    )

    assert account["name"] == "New Name"
    assert account["email"] == "new@example.com"
    assert account["authVersion"] == 4
    assert security.verify_password(new_password, account["passwordHash"])
    assert result["user"]["name"] == "New Name"
    assert result["user"]["email"] == "new@example.com"


def test_manager_profile_rejects_duplicate_email(monkeypatch):
    class Collection:
        async def update_one(self, _query, _update):
            raise auth.DuplicateKeyError("duplicate email")

    class Database:
        def __getitem__(self, _name):
            return Collection()

    monkeypatch.setattr(auth, "db", Database())
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            auth.update_manager_profile(
                "MGR0001",
                ManagerUpdate(name="New Name", email="used@example.com"),
                {"_id": "OWNER001", "role": "owner"},
            )
        )

    assert error.value.status_code == 409
    assert error.value.detail == "An account with this email already exists."


def test_owner_can_delete_inactive_manager_without_deleting_history(monkeypatch):
    account = {
        "_id": "MGR0001",
        "name": "Former Manager",
        "email": "manager@example.com",
        "passwordHash": "stored-hash",
        "role": "manager",
        "active": False,
        "authVersion": 2,
    }

    class Collection:
        async def update_one(self, query, update):
            assert query == {
                "_id": "MGR0001",
                "role": "manager",
                "active": False,
                "deleted": {"$ne": True},
            }
            account.update(update["$set"])
            for field in update["$unset"]:
                account.pop(field, None)
            account["authVersion"] += update["$inc"]["authVersion"]
            return type("Result", (), {"matched_count": 1})()

    class Database:
        def __getitem__(self, _name):
            return Collection()

    monkeypatch.setattr(auth, "db", Database())
    result = asyncio.run(
        auth.delete_manager(
            "MGR0001", {"_id": "OWNER001", "role": "owner"}
        )
    )

    assert result == {"id": "MGR0001", "deleted": True}
    assert account["deleted"] is True
    assert account["active"] is False
    assert account["authVersion"] == 3
    assert account["name"] == "Former Manager"
    assert "email" not in account
    assert "passwordHash" not in account


def test_owner_cannot_delete_active_manager(monkeypatch):
    account = {"_id": "MGR0001", "role": "manager", "active": True}

    class Collection:
        async def update_one(self, _query, _update):
            return type("Result", (), {"matched_count": 0})()

        async def find_one(self, _query):
            return account

    class Database:
        def __getitem__(self, _name):
            return Collection()

    monkeypatch.setattr(auth, "db", Database())
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            auth.delete_manager(
                "MGR0001", {"_id": "OWNER001", "role": "owner"}
            )
        )

    assert error.value.status_code == 409
    assert error.value.detail == "Deactivate the manager before deleting the account."


def test_inactive_account_cannot_sign_in(monkeypatch):
    account = {
        "_id": "MGR0001",
        "passwordHash": "stored-hash",
        "active": False,
        "authVersion": 0,
    }

    class Collection:
        async def find_one(self, _query):
            return account

    class Database:
        def __getitem__(self, _name):
            return Collection()

    request = Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": "/api/auth/login",
            "raw_path": b"/api/auth/login",
            "query_string": b"",
            "headers": [],
            "server": ("testserver", 80),
            "client": ("127.0.0.1", 1234),
        }
    )
    monkeypatch.setattr(auth, "db", Database())
    monkeypatch.setattr(auth, "verify_password", lambda _password, _hash: True)
    monkeypatch.setattr(auth, "check_login_rate_limit", lambda _request, _email: "key")
    monkeypatch.setattr(auth, "record_login_failure", lambda _key: None)

    with pytest.raises(HTTPException) as error:
        asyncio.run(
            auth.login(
                LoginRequest(email="manager@example.com", password="valid-password"),
                request,
                Response(),
            )
        )

    assert error.value.status_code == 401


def test_manager_status_update_rejects_non_manager_account(monkeypatch):
    class Collection:
        async def update_one(self, _query, _update):
            return type("Result", (), {"matched_count": 0})()

    class Database:
        def __getitem__(self, _name):
            return Collection()

    monkeypatch.setattr(auth, "db", Database())
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            auth.update_manager_status(
                "OWNER001",
                ManagerStatusUpdate(active=False),
                {"_id": "OWNER001", "role": "owner"},
            )
        )

    assert error.value.status_code == 404


def test_ownership_transfer_rejects_selecting_current_owner():
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            auth.transfer_ownership(
                OwnershipTransfer(managerId="OWNER001"),
                Response(),
                {"_id": "OWNER001"},
            )
        )

    assert error.value.status_code == 422


def test_ownership_transfer_swaps_roles_and_rotates_sessions(monkeypatch):
    accounts = {
        "OWNER001": {
            "_id": "OWNER001",
            "name": "Current Owner",
            "email": "owner@example.com",
            "role": "owner",
            "active": True,
            "authVersion": 0,
        },
        "MGR0001": {
            "_id": "MGR0001",
            "name": "New Owner",
            "email": "manager@example.com",
            "role": "manager",
            "active": True,
            "authVersion": 2,
        },
    }

    class Collection:
        async def update_one(self, query, update, session=None):
            account = accounts.get(query["_id"])
            if not account or account["role"] != query["role"] or not account["active"]:
                return type("Result", (), {"matched_count": 0})()
            account["role"] = update["$set"]["role"]
            account["authVersion"] += update["$inc"]["authVersion"]
            return type("Result", (), {"matched_count": 1})()

        async def find_one(self, query):
            return accounts.get(query["_id"])

    class Session:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return False

        async def with_transaction(self, callback):
            await callback(self)

    class Client:
        async def start_session(self):
            return Session()

    class Database:
        client = Client()

        def __getitem__(self, _name):
            return Collection()

    monkeypatch.setattr(auth, "db", Database())
    monkeypatch.setattr(auth, "create_session_token", lambda user_id, version: f"{user_id}:{version}")

    response = Response()
    result = asyncio.run(
        auth.transfer_ownership(
            OwnershipTransfer(managerId="MGR0001"),
            response,
            accounts["OWNER001"],
        )
    )

    assert accounts["OWNER001"]["role"] == "manager"
    assert accounts["OWNER001"]["authVersion"] == 1
    assert accounts["MGR0001"]["role"] == "owner"
    assert accounts["MGR0001"]["authVersion"] == 3
    assert result["user"]["isOwner"] is False
    assert "dt_session=OWNER001:1" in response.headers["set-cookie"]


def test_owner_setup_rejects_second_owner(monkeypatch):
    class Collection:
        async def find_one(self, _query, _projection=None):
            return {"_id": "OWNER001"}

        async def insert_one(self, _account):
            raise auth.DuplicateKeyError("owner already exists")

    class Database:
        def __getitem__(self, _name):
            return Collection()

    monkeypatch.setattr(auth, "db", Database())
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            auth.setup_owner(
                OwnerSetup(
                    name="Another Owner",
                    email="other@example.com",
                    password="long-enough-password",
                ),
                Response(),
            )
        )
    assert error.value.status_code == 409


def test_current_user_endpoint_rejects_requests_without_a_session():
    request = Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "GET",
            "scheme": "http",
            "path": "/api/auth/me",
            "raw_path": b"/api/auth/me",
            "query_string": b"",
            "headers": [],
            "server": ("testserver", 80),
            "client": ("127.0.0.1", 1234),
        }
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(security.current_account(request))

    assert error.value.status_code == 401


def test_login_rate_limit_after_five_failed_attempts():
    request = Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": "/api/auth/login",
            "raw_path": b"/api/auth/login",
            "query_string": b"",
            "headers": [],
            "server": ("testserver", 80),
            "client": ("192.0.2.1", 1234),
        }
    )
    key = security.check_login_rate_limit(request, "owner@example.com")
    for _ in range(security._MAX_LOGIN_FAILURES):
        security.record_login_failure(key)

    with pytest.raises(HTTPException) as error:
        security.check_login_rate_limit(request, "owner@example.com")

    assert error.value.status_code == 429
    security.clear_login_failures(key)
