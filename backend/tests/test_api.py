"""Backend API tests for Dentaltech Daily Flow (read-only demo).

Covers:
  - /api/health
  - /api/data (full payload keys + no _id leakage)
  - /api/data/{name} (known + unknown)
  - /api/catalog (materials count 93, toothGroups present)
  - /api/tracking/{token} (400 malformed, 404 unknown, 200 valid)
  - /api/clinics/{id}/contact (200/404)
"""
import datetime
import os
import re

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://structure-hub-46.preview.emergentagent.com").rstrip("/")

EXPECTED_KEYS = {
    "users", "cases", "toothOrders", "materialOrders", "reports", "leaveRequests",
    "otherWork", "drivers", "clinics", "routes", "stops", "routePlans",
    "notifications", "trackingEmails", "settings",
}


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def data_payload(client):
    r = client.get(f"{BASE_URL}/api/data", timeout=30)
    assert r.status_code == 200
    return r.json()


# ----- Health -----
def test_health(client):
    r = client.get(f"{BASE_URL}/api/health", timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j["status"] == "ok"
    assert "demo" in j.get("mode", "")


# ----- /api/data -----
def test_data_has_all_expected_keys(data_payload):
    missing = EXPECTED_KEYS - set(data_payload.keys())
    assert not missing, f"missing keys: {missing}"


def test_data_no_mongo_id_leakage(data_payload):
    def check(obj, path="root"):
        if isinstance(obj, dict):
            assert "_id" not in obj, f"_id leaked at {path}: {list(obj.keys())[:5]}"
            for k, v in obj.items():
                check(v, f"{path}.{k}")
        elif isinstance(obj, list):
            for i, v in enumerate(obj[:30]):
                check(v, f"{path}[{i}]")
    check(data_payload)


def test_data_counts_are_reasonable(data_payload):
    assert len(data_payload["users"]) >= 7
    assert len(data_payload["drivers"]) >= 3
    assert len(data_payload["clinics"]) == 8
    assert len(data_payload["routes"]) >= 2
    assert isinstance(data_payload["settings"], dict)


# ----- /api/data/{name} -----
@pytest.mark.parametrize("name", sorted(EXPECTED_KEYS - {"settings"}))
def test_single_collection(client, name):
    r = client.get(f"{BASE_URL}/api/data/{name}", timeout=15)
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)


def test_single_settings(client):
    r = client.get(f"{BASE_URL}/api/data/settings", timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), dict)


def test_unknown_collection_404(client):
    r = client.get(f"{BASE_URL}/api/data/doesnotexist", timeout=10)
    assert r.status_code == 404


# ----- /api/catalog -----
def test_catalog(client):
    r = client.get(f"{BASE_URL}/api/catalog", timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert "materials" in j and "toothGroups" in j
    assert len(j["materials"]) == 93, f"materials count {len(j['materials'])} != 93"
    assert len(j["toothGroups"]) > 0


# ----- /api/tracking/{token} -----
def test_tracking_malformed_token_400(client):
    r = client.get(f"{BASE_URL}/api/tracking/abc", timeout=10)
    assert r.status_code == 400


def test_tracking_unknown_valid_format_404(client):
    r = client.get(f"{BASE_URL}/api/tracking/{'0'*48}", timeout=10)
    assert r.status_code == 404


def _todays_token(routes):
    today = datetime.date.today().strftime("%Y%m%d")
    for r in routes:
        if r.get("id", "").startswith(f"R{today}"):
            toks = r.get("trackingTokens") or {}
            for _, tok in toks.items():
                if re.fullmatch(r"[a-f0-9]{48}", tok):
                    return tok
    return None


def test_tracking_valid_token_200(client, data_payload):
    tok = _todays_token(data_payload["routes"])
    assert tok, "no today-token found in seed"
    r = client.get(f"{BASE_URL}/api/tracking/{tok}", timeout=10)
    assert r.status_code == 200, r.text
    j = r.json()
    assert "_id" not in j
    # Should include some stop/visit level fields
    assert any(k in j for k in ("status", "stopId", "driverName", "clinicName"))


# ----- /api/clinics/{id}/contact -----
def test_clinic_contact_known(client):
    r = client.get(f"{BASE_URL}/api/clinics/C0001/contact", timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert "_id" not in j
    assert "email" in j or "phone" in j or j  # at least non-empty


def test_clinic_contact_unknown_404(client):
    r = client.get(f"{BASE_URL}/api/clinics/C9999/contact", timeout=10)
    assert r.status_code == 404
