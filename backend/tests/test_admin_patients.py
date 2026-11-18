from sqlalchemy import select
from conftest import headers
from app.models import User, Patient, Professional


def test_admin_creates_patient_with_profile_and_login(client, admin, db):
    data = dict(email='admin-created@example.com', first_name='Created', last_name='Patient',
                password='PatientTest123', confirm_password='PatientTest123', phone='+961 123456',
                date_of_birth='1970-01-01', address='Fictitious test address')
    response = client.post('/api/admin/patients', headers=headers(admin), json=data)
    assert response.status_code == 201
    created = response.json()
    assert created['role'] == 'patient' and created['phone'] == data['phone']
    user = db.get(User, created['id'])
    profile = db.get(Patient, user.UserID)
    assert profile and profile.Address == data['address']
    assert db.get(Professional, user.UserID) is None
    assert user.PasswordHash.startswith('$argon2')
    login = client.post('/api/auth/login', json={'email': data['email'], 'password': data['password']})
    assert login.status_code == 200 and login.json()['user']['role'] == 'patient'
    assert client.post('/api/admin/patients', headers=headers(admin), json=data).status_code == 409
    assert len(db.scalars(select(User).where(User.Email == data['email'])).all()) == 1


def test_patient_creation_requires_admin_and_rejects_role_override(client, admin, patient):
    data = dict(email='new-patient@example.com', first_name='Test', last_name='Patient',
                password='PatientTest123', confirm_password='PatientTest123')
    assert client.post('/api/admin/patients', json=data).status_code == 401
    assert client.post('/api/admin/patients', headers=headers(patient), json=data).status_code == 403
    assert client.post('/api/admin/patients', headers=headers(admin), json={**data, 'role': 'professional'}).status_code == 422
