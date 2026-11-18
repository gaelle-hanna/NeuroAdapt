import pytest
from conftest import headers
from app.models import Patient, Professional
from test_workflows import REG, PRO


@pytest.mark.parametrize('field', ['phone', 'date_of_birth', 'address'])
def test_patient_requires_role_details(client, admin, field):
    data = {k: v for k, v in REG.items() if k != field}
    assert client.post('/api/auth/register', json=data).status_code == 422
    assert client.post('/api/admin/patients', headers=headers(admin), json=data).status_code == 422


@pytest.mark.parametrize('field', ['phone', 'specialization', 'license_number', 'workplace'])
def test_professional_requires_role_details(client, admin, field):
    data = {k: v for k, v in PRO.items() if k != field}
    assert client.post('/api/admin/professionals', headers=headers(admin), json=data).status_code == 422


@pytest.mark.parametrize('changes', [{'date_of_birth': '2999-01-01'}, {'phone': '-------'}, {'address': '   '}])
def test_invalid_patient_details(client, changes):
    assert client.post('/api/auth/register', json={**REG, **changes}).status_code == 422


def test_public_patient_details_are_persisted(client, db):
    response = client.post('/api/auth/register', json=REG)
    assert response.status_code == 201
    profile = db.get(Patient, response.json()['id'])
    assert str(profile.DateOfBirth) == REG['date_of_birth']
    assert profile.Phone == REG['phone'] and profile.Address == REG['address']


def test_professional_details_are_persisted(client, admin, db):
    response = client.post('/api/admin/professionals', headers=headers(admin), json=PRO)
    assert response.status_code == 201
    profile = db.get(Professional, response.json()['id'])
    assert profile.Specialization == PRO['specialization']
    assert profile.LicenseNumber == PRO['license_number']
    assert profile.Phone == PRO['phone'] and profile.Workplace == PRO['workplace']


@pytest.mark.parametrize('role,details', [('patient', REG), ('professional', PRO)])
def test_phone_validation_is_shared_by_creation_and_profile_updates(client, admin, role, details):
    formatted = '+123 (456) 789-012-345'
    normalized = '+123456789012345'
    create_path = '/api/auth/register' if role == 'patient' else '/api/admin/professionals'
    create_headers = {} if role == 'patient' else headers(admin)

    for invalid in ('', '   ', '()+-', '123456', '1234567890123456', '1234567 ext 9', '123+4567'):
        assert client.post(create_path, json={**details, 'phone': invalid}, headers=create_headers).status_code == 422

    assert client.post(create_path, json={**details, 'phone': formatted}, headers=create_headers).status_code == 201
    login = client.post('/api/auth/login', json={k: details[k] for k in ('email', 'password')}).json()
    auth = headers(login)
    profile = client.get('/api/profiles/me', headers=auth).json()
    assert profile['phone'] == normalized

    update_path = f'/api/profiles/{role}'
    update = {k: v for k, v in details.items() if k not in ('password', 'confirm_password')}
    for invalid in ('', '   ', '()+-', '123456', '1234567890123456', '1234567 ext 9', '123+4567'):
        assert client.put(update_path, json={**update, 'phone': invalid}, headers=auth).status_code == 422
    assert client.get('/api/profiles/me', headers=auth).json()['phone'] == normalized

    assert client.put(update_path, json={**update, 'phone': '(123) 4567'}, headers=auth).json()['phone'] == '(123) 4567'
    assert client.put(update_path, json={**update, 'phone': formatted}, headers=auth).json()['phone'] == normalized
    assert client.put(update_path, json={**update, 'phone': None}, headers=auth).json()['phone'] is None
