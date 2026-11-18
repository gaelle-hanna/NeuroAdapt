import jwt
from datetime import datetime, timedelta, timezone
from conftest import headers
from app.core.config import settings, Settings
from app.models import User
from app.core.security import digest


def test_expired_and_forged_jwt(client, patient, db):
    user = db.get(User, patient['user']['id'])
    payload = dict(sub=str(user.UserID), exp=datetime.now(timezone.utc) - timedelta(seconds=1),
                   iat=datetime.now(timezone.utc) - timedelta(hours=1), iss='neuroadapt', aud='neuroadapt-web', pwd=digest(user.PasswordHash + settings.jwt_secret))
    token = jwt.encode(payload, settings.jwt_secret, algorithm='HS256')
    assert client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'}).status_code == 401
    forged = jwt.encode({**payload, 'exp': datetime.now(timezone.utc) + timedelta(minutes=5)}, 'wrong-secret-key-at-least-32-characters', algorithm='HS256')
    assert client.get('/api/auth/me', headers={'Authorization': f'Bearer {forged}'}).status_code == 401


def test_professional_profile_and_patient_deactivation(client, patient, admin):
    pro = dict(email='provider@example.com', first_name='Test', last_name='Provider', password='ProviderPass123', confirm_password='ProviderPass123', specialization='Neurology', license_number='TEST-002', phone='+961 70123456', workplace='Fictitious clinic')
    created = client.post('/api/admin/professionals', headers=headers(admin), json=pro).json()
    login = client.post('/api/auth/login', json={'email': pro['email'], 'password': pro['password']}).json()
    data = dict(email=pro['email'], first_name='Changed', last_name='Provider', specialization='Neurology', license_number='TEST-002', phone='+961 123456', workplace='Test clinic')
    assert client.put('/api/profiles/professional', headers=headers(login), json=data).status_code == 200
    assert client.get('/api/profiles/me', headers=headers(login)).json()['first_name'] == 'Changed'
    assert client.put('/api/profiles/patient', headers=headers(login), json={}).status_code == 403
    pid = patient['user']['id']
    client.post('/api/admin/assignments', headers=headers(admin), json={'patient_id': pid, 'professional_id': created['id']})
    client.patch(f'/api/admin/users/{pid}/status', headers=headers(admin), json={'status': 'inactive'})
    assert client.get(f'/api/monitoring/patients/{pid}', headers=headers(login)).status_code == 403


def test_password_whitespace_roundtrip(client):
    data = dict(email='space@example.com', first_name='Test', last_name='User', password=' Password123 ', confirm_password=' Password123 ', phone='+961 70123456', date_of_birth='1970-01-01', address='Fictitious address')
    assert client.post('/api/auth/register', json=data).status_code == 201
    assert client.post('/api/auth/login', json={'email': data['email'], 'password': data['password']}).status_code == 200


def test_production_configuration_rejects_development_reset_links():
    import pytest
    with pytest.raises(ValueError):
        Settings(database_url='mysql+pymysql://user:password@localhost/database', jwt_secret='production-test-only-secret-of-32-characters', environment='production', dev_reset_links=True, smtp_host='smtp.example.com')
