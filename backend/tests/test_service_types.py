import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from routers import service_types


class FakeServiceTypes:
    def __init__(self):
        self.documents = {}

    async def find_one(self, query):
        return next(
            (
                document
                for document in self.documents.values()
                if all(document.get(key) == value for key, value in query.items())
            ),
            None,
        )

    def find(self, query):
        matches = [
            document
            for document in self.documents.values()
            if all(document.get(key) == value for key, value in query.items())
        ]

        async def to_list(_length):
            return list(matches)

        return SimpleNamespace(to_list=to_list)

    async def insert_one(self, document):
        self.documents[document["_id"]] = document

    async def update_one(self, query, update):
        document = self.documents.get(query["_id"])
        if document is None:
            return SimpleNamespace(matched_count=0)
        document.update(update["$set"])
        return SimpleNamespace(matched_count=1)

    async def delete_one(self, query):
        deleted = self.documents.pop(query["_id"], None)
        return SimpleNamespace(deleted_count=int(deleted is not None))


class FakeDatabase:
    def __init__(self):
        self.collection = FakeServiceTypes()

    def __getitem__(self, name):
        assert name == "service_types"
        return self.collection


@pytest.fixture
def database(monkeypatch):
    fake = FakeDatabase()
    monkeypatch.setattr(service_types, "db", fake)
    return fake


def create(department, name):
    return asyncio.run(
        service_types.create_service_type(
            service_types.ServiceTypeCreate(department=department, name=name)
        )
    )


def test_service_type_name_is_trimmed_and_none_is_reserved():
    created = service_types.ServiceTypeCreate(
        department="ortho", name="  Special   Tray "
    )
    assert created.name == "Special Tray"

    for name in ("   ", "None", " none "):
        with pytest.raises(ValidationError):
            service_types.ServiceTypeCreate(department="ortho", name=name)
    with pytest.raises(ValidationError):
        service_types.ServiceTypeCreate(department="denture", name="Repair")


def test_departments_have_their_own_service_types(database):
    repair = create("prosthesis", "Repair")
    aligner = create("ortho", "Aligner")
    create("prosthesis", "Try In")
    create("ortho", "Repair")

    assert repair == {"id": repair["id"], "department": "prosthesis", "name": "Repair"}
    assert aligner["department"] == "ortho"
    listed = asyncio.run(service_types.list_service_types())
    assert [(item["department"], item["name"]) for item in listed] == [
        ("prosthesis", "Repair"),
        ("ortho", "Aligner"),
        ("prosthesis", "Try In"),
        ("ortho", "Repair"),
    ]


def test_service_type_names_are_unique_per_department(database):
    create("digital", "Scan Design")

    with pytest.raises(HTTPException) as error:
        create("digital", "scan  design")

    assert error.value.status_code == 409
    assert error.value.detail == "Scan Design already exists for Digital."
    assert len(database.collection.documents) == 1


def test_rename_and_delete_service_type(database):
    repair = create("prosthesis", "Repiar")
    finish = create("prosthesis", "Finish")

    renamed = asyncio.run(
        service_types.rename_service_type(
            repair["id"], service_types.ServiceTypeName(name="Repair")
        )
    )
    assert renamed == {"id": repair["id"], "department": "prosthesis", "name": "Repair"}
    assert database.collection.documents[repair["id"]]["nameKey"] == "repair"

    same_name = asyncio.run(
        service_types.rename_service_type(
            repair["id"], service_types.ServiceTypeName(name="REPAIR")
        )
    )
    assert same_name["name"] == "REPAIR"

    with pytest.raises(HTTPException) as error:
        asyncio.run(
            service_types.rename_service_type(
                finish["id"], service_types.ServiceTypeName(name="repair")
            )
        )
    assert error.value.status_code == 409

    assert asyncio.run(service_types.delete_service_type(finish["id"])) == {
        "id": finish["id"],
        "deleted": True,
    }
    with pytest.raises(HTTPException) as error:
        asyncio.run(service_types.delete_service_type(finish["id"]))
    assert error.value.status_code == 404
    with pytest.raises(HTTPException) as error:
        asyncio.run(
            service_types.rename_service_type(
                "missing", service_types.ServiceTypeName(name="Bite")
            )
        )
    assert error.value.status_code == 404


def route_roles_check(path, method):
    route = next(
        r
        for r in service_types.router.routes
        if r.path == path and method in r.methods
    )
    return route.dependant.dependencies[-1].call


@pytest.mark.parametrize(
    ("path", "method"),
    [
        ("/api/service-types", "POST"),
        ("/api/service-types/{service_type_id}", "PATCH"),
        ("/api/service-types/{service_type_id}", "DELETE"),
    ],
)
def test_only_managers_and_owners_change_service_types(path, method):
    check = route_roles_check(path, method)
    for role in ("owner", "manager"):
        assert asyncio.run(check({"role": role}))["role"] == role
    for role in ("technician", "driver"):
        with pytest.raises(HTTPException) as error:
            asyncio.run(check({"role": role}))
        assert error.value.status_code == 403


def test_technicians_can_read_service_types_but_drivers_cannot():
    check = route_roles_check("/api/service-types", "GET")
    assert asyncio.run(check({"role": "technician"}))["role"] == "technician"
    with pytest.raises(HTTPException) as error:
        asyncio.run(check({"role": "driver"}))
    assert error.value.status_code == 403
