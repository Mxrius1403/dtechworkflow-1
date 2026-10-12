import base64
import hashlib
import json
import secrets

from core.config import AUTH_SECRET_KEY
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_PREFIX = "v1:"


def encrypt_contact_fields(clinic_id: str, fields: dict[str, str]) -> str:
    key = hashlib.sha256(
        b"dtechworkflow:clinic-contacts:v1:" + AUTH_SECRET_KEY.encode("utf-8")
    ).digest()
    nonce = secrets.token_bytes(12)
    payload = json.dumps(fields, separators=(",", ":")).encode("utf-8")
    ciphertext = AESGCM(key).encrypt(nonce, payload, clinic_id.encode("utf-8"))
    return _PREFIX + base64.urlsafe_b64encode(nonce + ciphertext).decode("ascii")


def decrypt_contact_fields(clinic_id: str, value: str) -> dict[str, str]:
    if not value.startswith(_PREFIX):
        raise ValueError("Unsupported clinic contact ciphertext version.")
    key = hashlib.sha256(
        b"dtechworkflow:clinic-contacts:v1:" + AUTH_SECRET_KEY.encode("utf-8")
    ).digest()
    encrypted = base64.urlsafe_b64decode(value[len(_PREFIX) :].encode("ascii"))
    plaintext = AESGCM(key).decrypt(
        encrypted[:12], encrypted[12:], clinic_id.encode("utf-8")
    )
    fields = json.loads(plaintext)
    if not isinstance(fields, dict) or any(
        not isinstance(field, str) for field in fields.values()
    ):
        raise ValueError("Clinic contact ciphertext has an invalid payload.")
    return fields
