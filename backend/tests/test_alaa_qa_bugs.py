from threading import BoundedSemaphore

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from conftest import headers
from app.core.config import settings
from app.core.security import digest
from app.models import ResetToken
from app.routers import auth


def test_a01_response_body_precedes_token_work_and_smtp(monkeypatch, client, patient):
    monkeypatch.setattr(settings, 'smtp_host', 'smtp.example.com')
    sequence = []
    issue = auth.issue_reset_link

    def record_issue(email):
        sequence.append('lookup')
        return issue(email)

    def record_delivery(email, link):
        token_hash = digest(link.split('#token=')[1])
        with auth.SessionLocal() as db:
            committed = db.scalar(select(ResetToken).where(ResetToken.TokenHash == token_hash)) is not None
        sequence.append('smtp after commit' if committed else 'smtp before commit')

    monkeypatch.setattr(auth, 'issue_reset_link', record_issue)
    monkeypatch.setattr(auth, 'send_reset', record_delivery)

    async def observe(scope, receive, send):
        async def record(message):
            await send(message)
            if message['type'] == 'http.response.body' and not message.get('more_body', False):
                sequence.append('response')

        await client.app(scope, receive, record)

    with TestClient(observe) as observed:
        assert observed.post('/api/auth/forgot-password',
                             json={'email': 'patient@example.com'}).status_code == 200
        assert sequence == ['response', 'lookup', 'smtp after commit']
        sequence.clear()
        assert observed.post('/api/auth/forgot-password',
                             json={'email': 'unknown@example.com'}).status_code == 200
    assert sequence == ['response', 'lookup']


def test_a01_capacity_is_checked_without_account_lookup(monkeypatch, client, patient):
    capacity = BoundedSemaphore(1)
    capacity.acquire()
    monkeypatch.setattr(auth, 'reset_capacity', capacity)
    for email in ('patient@example.com', 'unknown@example.com'):
        response = client.post('/api/auth/forgot-password', json={'email': email})
        assert response.status_code == 503
        assert response.json() == {'detail': 'Data could not be saved or retrieved. Please try again.'}
    with auth.SessionLocal() as db:
        assert db.scalars(select(ResetToken)).all() == []
    capacity.release()
    assert client.post('/api/auth/forgot-password', json={'email': 'patient@example.com'}).status_code == 200


def test_a01_token_work_failure_is_generic_and_prevents_email(monkeypatch, client, patient, caplog):
    monkeypatch.setattr(settings, 'smtp_host', 'smtp.example.com')
    sent = []
    monkeypatch.setattr(auth, 'send_reset', lambda *args: sent.append(args))

    def fail(email):
        raise SQLAlchemyError('synthetic private database details')

    monkeypatch.setattr(auth, 'issue_reset_link', fail)
    response = client.post('/api/auth/forgot-password', json={'email': 'patient@example.com'})
    assert response.status_code == 200
    assert response.json() == {
        'message': 'If your address is registered, check your inbox for reset instructions.'
    }
    assert not sent
    assert 'Password reset link could not be issued' in caplog.text
    assert 'synthetic private database details' not in caplog.text


def test_a01_smtp_failure_is_logged_without_details(monkeypatch, client, patient, caplog):
    monkeypatch.setattr(settings, 'smtp_host', 'smtp.example.com')

    def fail(email, link):
        raise RuntimeError('synthetic private SMTP details')

    monkeypatch.setattr(auth, 'send_reset', fail)
    known = client.post('/api/auth/forgot-password', json={'email': 'patient@example.com'})
    unknown = client.post('/api/auth/forgot-password', json={'email': 'unknown@example.com'})
    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json() == {
        'message': 'If your address is registered, check your inbox for reset instructions.'
    }
    assert 'Password reset email delivery failed' in caplog.text
    assert 'synthetic private SMTP details' not in caplog.text


def test_a01_delivered_token_is_single_use(monkeypatch, client, patient):
    monkeypatch.setattr(settings, 'smtp_host', 'smtp.example.com')
    delivered = []
    monkeypatch.setattr(auth, 'send_reset', lambda email, link: delivered.append(link))
    response = client.post('/api/auth/forgot-password', json={'email': 'patient@example.com'})
    assert response.status_code == 200
    assert 'development_reset_link' not in response.json()
    assert len(delivered) == 1
    token = delivered[0].split('#token=')[1]
    data = {'token': token, 'password': 'ChangedPass123', 'confirm_password': 'ChangedPass123'}
    assert client.post('/api/auth/reset-password', json=data).status_code == 200
    assert client.post('/api/auth/reset-password', json=data).status_code == 400


def test_a05_numeric_monitoring_denials_remain_generic(client, patient, admin):
    professional = {
        'email': 'monitor@example.com', 'password': 'MonitorPass123',
        'confirm_password': 'MonitorPass123', 'first_name': 'Synthetic', 'last_name': 'Monitor',
        'specialization': 'Testing', 'license_number': 'QA-A05', 'phone': '+15550101234',
        'workplace': 'Synthetic workplace',
    }
    assert client.post('/api/admin/professionals', json=professional, headers=headers(admin)).status_code == 201
    session = client.post('/api/auth/login', json={
        'email': professional['email'], 'password': professional['password'],
    }).json()
    unassigned = client.get(f"/api/monitoring/patients/{patient['user']['id']}", headers=headers(session))
    unknown = client.get('/api/monitoring/patients/999999', headers=headers(session))
    assert unassigned.status_code == unknown.status_code == 403
    assert unassigned.json() == unknown.json()
