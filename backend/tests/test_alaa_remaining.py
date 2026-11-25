from datetime import date, timedelta

import pytest
from sqlalchemy import func, select

from app.models import User
from conftest import headers


@pytest.mark.parametrize('route', ['admin', 'self'])
def test_a02_professional_contact_required(client, admin, route):
    profile = dict(first_name='Synthetic', last_name='Provider', email='contact@example.com',
                   phone='+961 70123456', workplace='Synthetic clinic', specialization='QA',
                   license_number='CONTACT-QA')
    password = 'SyntheticContact123'
    created = client.post('/api/admin/professionals', headers=headers(admin),
                          json=dict(profile, password=password, confirm_password=password))
    assert created.status_code == 201
    login = client.post('/api/auth/login', json=dict(email=profile['email'], password=password))
    assert login.status_code == 200
    self_headers = headers(login.json())
    path, actor = (('/api/profiles/professional', self_headers) if route == 'self' else
                   (f"/api/admin/professionals/{created.json()['id']}", headers(admin)))
    for field, invalid in [('workplace', ''), ('workplace', ' \t '), ('workplace', None),
                           ('phone', ''), ('phone', '   '), ('phone', None), ('phone', '123')]:
        response = client.put(path, headers=actor, json={**profile, field: invalid})
        assert response.status_code == 422
        assert any(error['field'] == field for error in response.json()['detail'])
    for field in ('phone', 'workplace'):
        assert client.put(path, headers=actor, json={k: v for k, v in profile.items() if k != field}).status_code == 422
    saved = client.get('/api/profiles/me', headers=self_headers).json()
    assert (saved['phone'], saved['workplace']) == (profile['phone'], profile['workplace'])
    updated = client.put(path, headers=actor, json=dict(profile, phone='+1 (555) 010-1234',
                                                        workplace='  Updated QA clinic  '))
    assert updated.status_code == 200
    assert (updated.json()['phone'], updated.json()['workplace']) == ('+1 (555) 010-1234', 'Updated QA clinic')


@pytest.mark.parametrize('route', ['registration', 'admin', 'self'])
def test_a06_birth_date_boundaries_and_persistence(client, db, patient, admin, route):
    fields = dict(first_name='Synthetic', last_name='Patient', phone='+15550101234',
                  address='Synthetic address')
    password = 'SyntheticBirth123'
    actor = headers(patient) if route == 'self' else headers(admin) if route == 'admin' else {}
    path = {'registration': '/api/auth/register', 'admin': '/api/admin/patients',
            'self': '/api/profiles/patient'}[route]
    today = date.today()
    baseline = client.get('/api/profiles/me', headers=headers(patient)).json()['date_of_birth']
    count = db.scalar(select(func.count()).select_from(User))
    cases = [('0001-01-01', False), ('1800-01-01', False), ('1899-12-31', False),
             ((today + timedelta(days=1)).isoformat(), False), ('2001-02-29', False),
             ('1900-01-01', True), ('1980-07-01', True), (today.isoformat(), True)]
    for index, (birth, valid) in enumerate(cases):
        if route == 'self':
            response = client.put(path, headers=actor,
                                  json=dict(fields, email=patient['user']['email'], date_of_birth=birth))
        else:
            response = client.post(path, headers=actor, json=dict(
                fields, email=f'birth-{index}@example.com', date_of_birth=birth,
                password=password, confirm_password=password))
        if valid:
            assert response.status_code == (200 if route == 'self' else 201)
            count += route != 'self'
        else:
            assert response.status_code == 422
            assert any(error['field'] == 'date_of_birth' for error in response.json()['detail'])
        assert db.scalar(select(func.count()).select_from(User)) == count
        if route == 'self':
            saved = client.get('/api/profiles/me', headers=actor).json()
            assert saved['date_of_birth'] == (birth if valid else baseline)
