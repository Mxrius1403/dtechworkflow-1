from datetime import datetime, timezone
from typing import Literal

from core.collections import AUTH_USERS
from core.database import db
from core.security import (
    _DUMMY_PASSWORD_HASH,
    SESSION_COOKIE,
    check_login_rate_limit,
    clear_login_failures,
    clear_session_cookie,
    create_session_token,
    current_account,
    decode_session_token,
    hash_password,
    public_account,
    record_login_failure,
    require_allowed_origin,
    require_role,
    set_session_cookie,
    verify_password,
)
from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError

router = APIRouter(prefix="/api/auth", tags=["authentication"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class OwnerSetup(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=12, max_length=72)


class TechnicianCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=12, max_length=72)
    department: Literal["denture", "ortho", "digital"]


@router.get("/setup")
async def get_setup_status() -> dict:
    collection = db[AUTH_USERS]
    owner = await collection.find_one({"_id": "OWNER001"}, {"_id": 1})
    return {"required": owner is None}


@router.post(
    "/setup",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_allowed_origin)],
)
async def setup_owner(body: OwnerSetup, response: Response) -> dict:
    name = body.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enter a name.",
        )
    if not 12 <= len(body.password.encode("utf-8")) <= 72:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be between 12 and 72 UTF-8 bytes.",
        )

    try:
        email = validate_email(
            str(body.email), check_deliverability=False
        ).normalized.lower()
    except EmailNotValidError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enter a valid email address.",
        ) from error

    account = {
        "_id": "OWNER001",
        "name": name,
        "email": email,
        "passwordHash": hash_password(body.password),
        "role": "owner",
        "department": None,
        "active": True,
        "authVersion": 0,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    collection = db[AUTH_USERS]
    try:
        await collection.insert_one(account)
    except DuplicateKeyError as error:
        if await collection.find_one({"_id": "OWNER001"}):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The owner account has already been set up.",
            ) from error
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from error

    token = create_session_token(str(account["_id"]), account["authVersion"])
    set_session_cookie(response, token)
    return {"user": public_account(account)}


async def allocate_technician_id() -> str:
    used_ids = {
        row["_id"] for row in await db["users"].find({}, {"_id": 1}).to_list(10_000)
    }
    used_ids.update(
        row["_id"] for row in await db[AUTH_USERS].find({}, {"_id": 1}).to_list(10_000)
    )
    for collection_name, fields in (
        ("cases", ("technicianId", "finishedById")),
        ("other_work", ("technicianId",)),
        ("tooth_orders", ("technicianId",)),
        ("material_orders", ("requestedById",)),
    ):
        for row in (
            await db[collection_name]
            .find({}, {field: 1 for field in fields})
            .to_list(10_000)
        ):
            used_ids.update(row.get(field) for field in fields if row.get(field))
    number = 1
    while f"DT{number:03d}" in used_ids:
        number += 1
    return f"DT{number:03d}"


@router.post("/login", dependencies=[Depends(require_allowed_origin)])
async def login(body: LoginRequest, request: Request, response: Response) -> dict:
    try:
        email = validate_email(
            str(body.email), check_deliverability=False
        ).normalized.lower()
    except EmailNotValidError:
        email = str(body.email).strip().lower()
    rate_limit_key = check_login_rate_limit(request, email)
    account = await db[AUTH_USERS].find_one({"email": email})
    password_hash = account.get("passwordHash") if account else _DUMMY_PASSWORD_HASH
    valid_password = verify_password(body.password, password_hash)
    if not account or not valid_password or not account.get("active", False):
        record_login_failure(rate_limit_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect.",
        )

    clear_login_failures(rate_limit_key)
    token = create_session_token(str(account["_id"]), account.get("authVersion", 0))
    set_session_cookie(response, token)
    return {"user": public_account(account)}


@router.post("/logout", dependencies=[Depends(require_allowed_origin)])
async def logout(request: Request, response: Response) -> dict:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        claims = decode_session_token(token)
        if claims:
            await db[AUTH_USERS].update_one(
                {"_id": claims["sub"]}, {"$inc": {"authVersion": 1}}
            )
    clear_session_cookie(response)
    return {"status": "ok"}


@router.get("/me")
async def get_me(account: dict = Depends(current_account)) -> dict:
    return {"user": public_account(account)}


@router.post(
    "/technicians",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_allowed_origin)],
)
async def create_technician(
    body: TechnicianCreate,
    owner: dict = Depends(require_role("owner")),
) -> dict:
    password_bytes = body.password.encode("utf-8")
    if len(password_bytes) > 72:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be no longer than 72 UTF-8 bytes.",
        )

    try:
        email = validate_email(
            str(body.email), check_deliverability=False
        ).normalized.lower()
    except EmailNotValidError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enter a valid email address.",
        ) from error

    account = {
        "name": body.name.strip(),
        "email": email,
        "passwordHash": hash_password(body.password),
        "role": "technician",
        "department": body.department,
        "active": True,
        "authVersion": 0,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "createdBy": str(owner["_id"]),
    }
    if not account["name"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Enter a name."
        )
    for _ in range(3):
        account["_id"] = await allocate_technician_id()
        try:
            await db[AUTH_USERS].insert_one(account)
            break
        except DuplicateKeyError as error:
            if await db[AUTH_USERS].find_one({"email": email}):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account with this email already exists.",
                ) from error
    else:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not allocate a unique technician ID.",
        )
    return {"user": public_account(account)}
