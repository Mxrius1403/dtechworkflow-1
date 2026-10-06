import asyncio

import pytest
from core import security
from fastapi import HTTPException
from pydantic import ValidationError
from routers import auth
from routers.auth import LoginRequest, TechnicianCreate
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


def test_technician_credentials_and_department_are_validated():
    with pytest.raises(ValidationError):
        TechnicianCreate(
            name="New Tech",
            email="tech@example.com",
            password="short",
            department="denture",
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


def test_owner_provisioning_creates_first_owner(monkeypatch):
    class Collection:
        account = None

        async def find_one(self, _query):
            return self.account

        async def replace_one(self, _query, account, upsert):
            self.account = account
            assert upsert

    class Database:
        def __init__(self):
            self.collection = Collection()

        def __getitem__(self, _name):
            return self.collection

    database = Database()
    monkeypatch.setattr(auth, "db", database)

    asyncio.run(auth.provision_owner("owner@example.com", "long-enough-password", "Owner"))

    assert database.collection.account["authVersion"] == 0
    assert database.collection.account["role"] == "owner"
    assert security.verify_password(
        "long-enough-password", database.collection.account["passwordHash"]
    )


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
