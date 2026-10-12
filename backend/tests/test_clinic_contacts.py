import pytest
from cryptography.exceptions import InvalidTag

from core import clinic_contacts


def test_clinic_contact_fields_round_trip_without_plaintext_storage(monkeypatch):
    monkeypatch.setattr(clinic_contacts, "AUTH_SECRET_KEY", "test-key" * 8)
    fields = {
        "email": "clinic@example.test",
        "phone": "012345678",
        "contact": "Practice Manager",
        "notes": "Call on arrival",
    }

    encrypted = clinic_contacts.encrypt_contact_fields("C1234", fields)

    assert "clinic@example.test" not in encrypted
    assert clinic_contacts.decrypt_contact_fields("C1234", encrypted) == fields


def test_clinic_contact_ciphertext_is_bound_to_clinic_and_key(monkeypatch):
    monkeypatch.setattr(clinic_contacts, "AUTH_SECRET_KEY", "test-key" * 8)
    encrypted = clinic_contacts.encrypt_contact_fields(
        "C1234", {"email": "clinic@example.test"}
    )

    with pytest.raises(InvalidTag):
        clinic_contacts.decrypt_contact_fields("C9999", encrypted)

    monkeypatch.setattr(clinic_contacts, "AUTH_SECRET_KEY", "other-key" * 8)
    with pytest.raises(InvalidTag):
        clinic_contacts.decrypt_contact_fields("C1234", encrypted)
