from datetime import timedelta
from sqlalchemy import select
import pytest
from conftest import headers
from app.models import User, Patient, ResetToken, now
from app.core.config import settings
from app.core.security import digest

REG = dict(email='new@example.com', first_name='New', last_name='Patient', password='Password1234', confirm_password='Password1234', phone='+961 70123456', date_of_birth='1970-01-01', address='Fictitious address')
MED = dict(medication_name='Test medication', dosage='100 mg', frequency='Once daily', instructions='Fictitious test only')
PRO = dict(email='pro@example.com', first_name='Test', last_name='Professional', password='Professional123', confirm_password='Professional123', specialization='Neurology', license_number='TEST-001', phone='+961 70123456', workplace='Fictitious clinic')


def test_registration_atomic_and_hashed(client, db):
    r = client.post('/api/auth/register', json=REG)
    assert r.status_code == 201
    u = db.get(User, r.json()['id'])
    assert u.PasswordHash.startswith('$argon2') and db.get(Patient, u.UserID)
    assert 'PasswordHash' not in r.text
    assert client.post('/api/auth/register', json=REG).status_code == 409
    assert client.post('/api/auth/register', json={**REG, 'role': 'admin'}).status_code == 422


@pytest.mark.parametrize('changes', [{'email': 'invalid'}, {'first_name': ''}, {'password': 'short'}, {'confirm_password': 'different'}])
def test_invalid_registration(client, changes):
    r = client.post('/api/auth/register', json={**REG, **changes})
    assert r.status_code == 422
    assert 'Password1234' not in r.text


def test_login_and_inactive_account(client, patient, admin):
    assert patient['user']['role'] == 'patient'
    assert client.post('/api/auth/login', json={'email': 'patient@example.com', 'password': 'wrong'}).status_code == 401
    assert client.patch(f"/api/admin/users/{patient['user']['id']}/status", headers=headers(admin), json={'status': 'inactive'}).status_code == 200
    assert client.post('/api/auth/login', json={'email': 'patient@example.com', 'password': 'PatientPass123'}).status_code == 403
    assert client.get('/api/auth/me', headers=headers(patient)).status_code == 401


def test_profile_and_role_protection(client, patient):
    data = dict(first_name='Updated', last_name='Patient', email='updated@example.com', phone='+961 123456', date_of_birth='1960-01-01', address='Test address')
    assert client.put('/api/profiles/patient', json=data).status_code == 401
    assert client.put('/api/profiles/patient', json=data, headers=headers(patient)).status_code == 200
    assert client.get('/api/profiles/me', headers=headers(patient)).json()['first_name'] == 'Updated'
    assert client.put('/api/profiles/patient', json={**data, 'patient_id': 99}, headers=headers(patient)).status_code == 422
    assert client.get('/api/admin/users', headers=headers(patient)).status_code == 403
    assert client.get('/api/monitoring/patients', headers=headers(patient)).status_code == 403
    assert client.put('/api/profiles/professional', json={}, headers=headers(patient)).status_code == 403


def test_medication_intakes_and_ownership(client, patient):
    h = headers(patient)
    assert client.get('/api/medications/intakes/history', headers=h).json() == []
    med = client.post('/api/medications', headers=h, json=MED).json()
    payload = dict(medication_id=med['id'], taken_at=(now() - timedelta(minutes=1)).isoformat() + 'Z', notes='Test note')
    assert client.post('/api/medications/intakes', headers=h, json=payload).status_code == 201
    rows = client.get('/api/medications/intakes/history', headers=h).json()
    assert rows[0]['dosage'] == '100 mg' and rows[0]['notes'] == 'Test note'
    assert client.post('/api/medications/intakes', headers=h, json={**payload, 'taken_at': (now() + timedelta(days=1)).isoformat() + 'Z'}).status_code == 422
    client.post('/api/auth/register', json=REG)
    other = client.post('/api/auth/login', json={'email': REG['email'], 'password': REG['password']}).json()
    assert client.post('/api/medications/intakes', headers=headers(other), json=payload).status_code == 404
    assert client.put(f"/api/medications/{med['id']}", headers=headers(other), json=MED).status_code == 404
    assert client.get('/api/medications/intakes/history', headers=headers(other)).json() == []
    assert client.put(f"/api/medications/{med['id']}", headers=h, json={**MED, 'is_active': False}).status_code == 200
    assert client.post('/api/medications/intakes', headers=h, json=payload).status_code == 400
    assert len(client.get('/api/medications/intakes/history', headers=h).json()) == 1


def test_assignment_monitoring_lifecycle(client, patient, admin):
    ah = headers(admin)
    pro = client.post('/api/admin/professionals', headers=ah, json=PRO)
    assert pro.status_code == 201
    assert client.post('/api/admin/professionals', headers=ah, json={**PRO, 'email': 'other@example.com'}).status_code == 409
    ph = headers(client.post('/api/auth/login', json={'email': PRO['email'], 'password': PRO['password']}).json())
    pid = patient['user']['id']
    assert client.get('/api/monitoring/patients', headers=ph).json() == []
    assert client.get(f'/api/monitoring/patients/{pid}', headers=ph).status_code == 403
    body = dict(patient_id=pid, professional_id=pro.json()['id'])
    a = client.post('/api/admin/assignments', headers=ah, json=body)
    assert a.status_code == 201
    assert client.post('/api/admin/assignments', headers=ah, json=body).status_code == 409
    assert client.get(f'/api/monitoring/patients/{pid}', headers=ph).json()['history'] == []
    assert len(client.get('/api/monitoring/patients', headers=ph).json()) == 1
    assert client.get(f'/api/monitoring/patients/{pid}/history', headers=ph).status_code == 200
    assert client.delete(f"/api/admin/assignments/{a.json()['id']}", headers=ah).status_code == 200
    assert client.get(f'/api/monitoring/patients/{pid}', headers=ph).status_code == 403
    assert client.post('/api/admin/assignments', headers=ah, json=body).status_code == 201
    assignments = client.get('/api/admin/assignments', headers=ah).json()
    assert len(assignments) == 2 and assignments[1]['status'] == 'inactive'
    assert client.post('/api/admin/assignments', headers=headers(patient), json=body).status_code == 403


@pytest.mark.parametrize('kind', ['valid', 'expired', 'reused'])
def test_reset_tokens(client, patient, db, monkeypatch, kind):
    monkeypatch.setattr(settings, 'environment', 'development')
    monkeypatch.setattr(settings, 'dev_reset_links', True)
    monkeypatch.setattr(settings, 'smtp_host', '')
    result = client.post('/api/auth/forgot-password', json={'email': 'patient@example.com'}).json()
    token = result['development_reset_link'].split('#token=')[1]
    stored = db.scalar(select(ResetToken).where(ResetToken.TokenHash == digest(token)))
    assert stored and stored.TokenHash != token
    if kind == 'expired':
        stored.ExpiresAt = now() - timedelta(minutes=1)
        db.commit()
    payload = dict(token=token, password='ChangedPassword123', confirm_password='ChangedPassword123')
    r = client.post('/api/auth/reset-password', json=payload)
    assert r.status_code == (400 if kind == 'expired' else 200)
    if kind != 'expired':
        assert client.post('/api/auth/reset-password', json=payload).status_code == 400
        assert client.get('/api/auth/me', headers=headers(patient)).status_code == 401
        assert client.post('/api/auth/login', json={'email': 'patient@example.com', 'password': payload['password']}).status_code == 200


def test_reset_no_enumeration_and_rate_limit(client, patient):
    known = client.post('/api/auth/forgot-password', json={'email': 'patient@example.com'})
    unknown = client.post('/api/auth/forgot-password', json={'email': 'unknown@example.com'})
    assert known.json() == unknown.json() and 'token' not in known.text.lower()
    for _ in range(3):
        client.post('/api/auth/forgot-password', json={'email': 'unknown@example.com'})
    assert client.post('/api/auth/forgot-password', json={'email': 'unknown@example.com'}).status_code == 429
