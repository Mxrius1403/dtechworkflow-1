from datetime import datetime, timezone

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
    require_roles,
    set_session_cookie,
    verify_password,
)
from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
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
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=12, max_length=72)


class TechnicianStatusUpdate(BaseModel):
    active: bool


class ManagerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=12, max_length=72)


class ManagerStatusUpdate(BaseModel):
    active: bool


class OwnershipTransfer(BaseModel):
    manager_id: str = Field(validation_alias="managerId", min_length=1, max_length=100)


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


async def allocate_manager_id() -> str:
    used_ids = {
        row["_id"] for row in await db["users"].find({}, {"_id": 1}).to_list(10_000)
    }
    used_ids.update(
        row["_id"] for row in await db[AUTH_USERS].find({}, {"_id": 1}).to_list(10_000)
    )
    number = 1
    while f"MGR{number:04d}" in used_ids:
        number += 1
    return f"MGR{number:04d}"


def normalized_email(value: str) -> str:
    try:
        return validate_email(value, check_deliverability=False).normalized.lower()
    except EmailNotValidError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enter a valid email address.",
        ) from error


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
    creator: dict = Depends(require_roles("owner", "manager")),
) -> dict:
    password_bytes = body.password.encode("utf-8")
    if len(password_bytes) > 72:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be no longer than 72 UTF-8 bytes.",
        )

    email = normalized_email(str(body.email))

    account = {
        "name": body.name.strip(),
        "email": email,
        "passwordHash": hash_password(body.password),
        "role": "technician",
        "active": True,
        "authVersion": 0,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "createdBy": str(creator["_id"]),
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


@router.patch(
    "/technicians/{technician_id}",
    dependencies=[Depends(require_allowed_origin)],
)
async def update_technician_status(
    technician_id: str,
    body: TechnicianStatusUpdate,
    _: dict = Depends(require_roles("owner", "manager")),
) -> dict:
    result = await db[AUTH_USERS].update_one(
        {
            "_id": technician_id,
            "role": "technician",
            "deleted": {"$ne": True},
        },
        {"$set": {"active": body.active}, "$inc": {"authVersion": 1}},
    )
    if result.matched_count != 1:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Technician account not found.",
        )

    account = await db[AUTH_USERS].find_one({"_id": technician_id})
    return {"user": public_account(account)}


@router.delete(
    "/technicians/{technician_id}",
    dependencies=[Depends(require_allowed_origin)],
)
async def delete_technician(
    technician_id: str,
    manager: dict = Depends(require_roles("owner", "manager")),
) -> dict:
    result = await db[AUTH_USERS].update_one(
        {
            "_id": technician_id,
            "role": "technician",
            "active": False,
            "deleted": {"$ne": True},
        },
        {
            "$set": {
                "deleted": True,
                "deletedAt": datetime.now(timezone.utc).isoformat(),
                "deletedBy": str(manager["_id"]),
            },
            "$unset": {"email": "", "passwordHash": ""},
            "$inc": {"authVersion": 1},
        },
    )
    if result.matched_count != 1:
        account = await db[AUTH_USERS].find_one(
            {"_id": technician_id, "role": "technician"}
        )
        if account and account.get("active") and not account.get("deleted"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Deactivate the technician before deleting the account.",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Technician account not found.",
        )

    return {"id": technician_id, "deleted": True}


@router.get("/managers", dependencies=[Depends(require_role("owner"))])
async def list_managers() -> dict:
    accounts = await db[AUTH_USERS].find({"role": "manager"}).to_list(10_000)
    return {"managers": [public_account(account) for account in accounts]}


@router.post(
    "/managers",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_allowed_origin)],
)
async def create_manager(
    body: ManagerCreate,
    owner: dict = Depends(require_role("owner")),
) -> dict:
    if not body.name.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Enter a name."
        )
    if len(body.password.encode("utf-8")) > 72:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be no longer than 72 UTF-8 bytes.",
        )

    email = normalized_email(str(body.email))
    account = {
        "name": body.name.strip(),
        "email": email,
        "passwordHash": hash_password(body.password),
        "role": "manager",
        "department": None,
        "active": True,
        "authVersion": 0,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "createdBy": str(owner["_id"]),
    }
    for _ in range(3):
        account["_id"] = await allocate_manager_id()
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
            detail="Could not allocate a unique manager ID.",
        )
    return {"user": public_account(account)}


@router.patch(
    "/managers/{manager_id}",
    dependencies=[Depends(require_allowed_origin)],
)
async def update_manager_status(
    manager_id: str,
    body: ManagerStatusUpdate,
    owner: dict = Depends(require_role("owner")),
) -> dict:
    result = await db[AUTH_USERS].update_one(
        {"_id": manager_id, "role": "manager"},
        {"$set": {"active": body.active}, "$inc": {"authVersion": 1}},
    )
    if result.matched_count != 1:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Manager account not found.",
        )

    account = await db[AUTH_USERS].find_one({"_id": manager_id})
    return {"user": public_account(account)}


@router.post(
    "/ownership/transfer",
    dependencies=[Depends(require_allowed_origin)],
)
async def transfer_ownership(
    body: OwnershipTransfer,
    response: Response,
    owner: dict = Depends(require_role("owner")),
) -> dict:
    owner_id = str(owner["_id"])
    if body.manager_id == owner_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Choose a different manager.",
        )

    async def transfer(session) -> None:
        result = await db[AUTH_USERS].update_one(
            {"_id": owner_id, "role": "owner", "active": True},
            {"$set": {"role": "manager"}, "$inc": {"authVersion": 1}},
            session=session,
        )
        if result.matched_count != 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Owner permissions have changed. Refresh and try again.",
            )

        result = await db[AUTH_USERS].update_one(
            {"_id": body.manager_id, "role": "manager", "active": True},
            {"$set": {"role": "owner"}, "$inc": {"authVersion": 1}},
            session=session,
        )
        if result.matched_count != 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The selected manager is no longer active. Refresh and try again.",
            )

    async with await db.client.start_session() as session:
        await session.with_transaction(transfer)

    updated_owner = await db[AUTH_USERS].find_one({"_id": owner_id})
    token = create_session_token(owner_id, updated_owner.get("authVersion", 0))
    set_session_cookie(response, token)
    return {"user": public_account(updated_owner)}
