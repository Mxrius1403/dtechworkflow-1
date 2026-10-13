from datetime import datetime, timedelta, timezone
from hashlib import sha256
from secrets import compare_digest
from time import monotonic
from typing import Any
from urllib.parse import urlsplit

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, Response, status

from core.collections import AUTH_USERS
from core.config import (
    AUTH_COOKIE_SECURE,
    AUTH_SECRET_KEY,
    CORS_ORIGINS,
    OWNER_SETUP_SECRET,
)
from core.database import db

SESSION_COOKIE = "dt_session"
SESSION_TTL_SECONDS = 30 * 60
JWT_ISSUER = "dtechworkflow"
_DUMMY_PASSWORD_HASH = bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt(rounds=12))
_LOGIN_FAILURE_WINDOW_SECONDS = 15 * 60
_MAX_LOGIN_FAILURES = 5
_login_failures: dict[str, list[float]] = {}
# Accounts whose password was set by an owner or manager may only reach these
# endpoints until they have chosen their own password.
PASSWORD_CHANGE_ALLOWED_PATHS = frozenset(
    {"/api/auth/me", "/api/auth/me/password", "/api/auth/refresh"}
)


def validate_security_config() -> None:
    if not AUTH_SECRET_KEY or len(AUTH_SECRET_KEY.encode("utf-8")) < 32:
        raise RuntimeError(
            "AUTH_SECRET_KEY must be set to a random value of at least 32 bytes."
        )
    if len(OWNER_SETUP_SECRET.encode("utf-8")) < 32:
        raise RuntimeError(
            "OWNER_SETUP_SECRET must be set to a random value of at least 32 bytes."
        )
    if "*" in CORS_ORIGINS:
        raise RuntimeError(
            "CORS_ORIGINS must list explicit frontend origins when cookie authentication is enabled."
        )
    if not CORS_ORIGINS:
        raise RuntimeError(
            "CORS_ORIGINS must contain at least one explicit frontend origin."
        )


def hash_password(password: str) -> str:
    encoded = password.encode("utf-8")
    if len(encoded) > 72:
        raise ValueError("Passwords must be no longer than 72 UTF-8 bytes.")
    return bcrypt.hashpw(encoded, bcrypt.gensalt(rounds=12)).decode("ascii")


def verify_password(password: str, password_hash: str | bytes) -> bool:
    try:
        encoded = password.encode("utf-8")
        stored_hash = (
            password_hash.encode("ascii")
            if isinstance(password_hash, str)
            else password_hash
        )
        return len(encoded) <= 72 and bcrypt.checkpw(encoded, stored_hash)
    except (AttributeError, ValueError, TypeError, UnicodeEncodeError):
        return False


def verify_setup_secret(candidate: str) -> bool:
    return bool(OWNER_SETUP_SECRET) and compare_digest(candidate, OWNER_SETUP_SECRET)


def create_session_token(user_id: str, auth_version: int) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": user_id,
            "iat": now,
            "exp": now + timedelta(seconds=SESSION_TTL_SECONDS),
            "ver": auth_version,
            "iss": JWT_ISSUER,
        },
        AUTH_SECRET_KEY,
        algorithm="HS256",
    )


def decode_session_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(
            token,
            AUTH_SECRET_KEY,
            algorithms=["HS256"],
            issuer=JWT_ISSUER,
            options={"require": ["sub", "iat", "exp", "ver", "iss"]},
        )
    except jwt.InvalidTokenError:
        return None


def public_account(account: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(account["_id"]),
        "name": account["name"],
        "email": account["email"],
        "role": account["role"],
        "department": (
            None if account.get("role") == "technician" else account.get("department")
        ),
        "active": account["active"],
        "isOwner": account["role"] == "owner",
        "isManager": account["role"] in ("owner", "manager"),
        "isDriver": account["role"] == "driver",
        "mustChangePassword": bool(account.get("mustChangePassword")),
    }


async def current_account(request: Request) -> dict[str, Any]:
    token = request.cookies.get(SESSION_COOKIE)
    claims = decode_session_token(token) if token else None
    if not claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required."
        )
    account = await db[AUTH_USERS].find_one({"_id": claims["sub"], "active": True})
    if not account or account.get("authVersion", 0) != claims["ver"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required."
        )
    if (
        account.get("mustChangePassword")
        and request.url.path not in PASSWORD_CHANGE_ALLOWED_PATHS
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Change your password to continue.",
        )
    return account


def require_role(role: str):
    return require_roles(role)


def require_roles(*roles: str):
    async def check_role(
        account: dict[str, Any] = Depends(current_account),
    ) -> dict[str, Any]:
        if account.get("role") not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions.",
            )
        return account

    return check_role


def has_allowed_request_origin(request: Request) -> bool:
    origin = request.headers.get("origin")
    if origin:
        return origin != "null" and origin.rstrip("/") in CORS_ORIGINS

    referer = request.headers.get("referer")
    if not referer:
        return False

    parsed_referer = urlsplit(referer)
    if parsed_referer.scheme not in ("http", "https") or not parsed_referer.netloc:
        return False
    referer_origin = f"{parsed_referer.scheme}://{parsed_referer.netloc}"
    return referer_origin in CORS_ORIGINS


def require_allowed_origin(request: Request) -> None:
    if not has_allowed_request_origin(request):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Request origin is missing or not allowed.",
        )


def check_login_rate_limit(request: Request, email: str) -> str:
    client_ip = request.client.host if request.client else "unknown"
    key = sha256(f"{client_ip}:{email}".encode("utf-8")).hexdigest()
    now = monotonic()
    recent = [
        stamp
        for stamp in _login_failures.get(key, [])
        if now - stamp < _LOGIN_FAILURE_WINDOW_SECONDS
    ]
    _login_failures[key] = recent
    if len(recent) >= _MAX_LOGIN_FAILURES:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many sign-in attempts. Try again later.",
        )
    return key


def record_login_failure(key: str) -> None:
    now = monotonic()
    if len(_login_failures) > 10_000:
        for old_key, stamps in list(_login_failures.items()):
            if not stamps or now - stamps[-1] >= _LOGIN_FAILURE_WINDOW_SECONDS:
                _login_failures.pop(old_key, None)
        if len(_login_failures) > 10_000:
            _login_failures.pop(next(iter(_login_failures)))
    _login_failures.setdefault(key, []).append(now)


def clear_login_failures(key: str) -> None:
    _login_failures.pop(key, None)


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite="none" if AUTH_COOKIE_SECURE else "lax",
        path="/api",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE,
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite="none" if AUTH_COOKIE_SECURE else "lax",
        path="/api",
    )
