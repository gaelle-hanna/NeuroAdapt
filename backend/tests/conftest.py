import os
os.environ['ENVIRONMENT'] = 'test'
os.environ['DATABASE_URL'] = 'sqlite://'
os.environ['JWT_SECRET'] = 'test-only-secret-value-at-least-32-characters'
os.environ['DEV_RESET_LINKS'] = 'false'

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from app.database import Base, get_db
from app.main import app
from app.core.security import limiter
from app.models import User
from app.routers import auth
from app.schemas import Registration
from app.services.accounts import create_account


@pytest.fixture()
def db():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    @event.listens_for(engine, 'connect')
    def fk(connection, record):
        connection.execute('PRAGMA foreign_keys=ON')
    Base.metadata.create_all(engine)
    with sessionmaker(engine, expire_on_commit=False)() as session:
        yield session
    engine.dispose()


@pytest.fixture()
def client(db, monkeypatch):
    app.dependency_overrides[get_db] = lambda: db
    monkeypatch.setattr(auth, 'SessionLocal', sessionmaker(db.get_bind(), expire_on_commit=False))
    limiter.entries.clear()
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture()
def patient(client):
    data = dict(email='patient@example.com', first_name='Test', last_name='Patient', password='PatientPass123', confirm_password='PatientPass123', phone='+961 70123456', date_of_birth='1970-01-01', address='Fictitious address')
    assert client.post('/api/auth/register', json=data).status_code == 201
    return client.post('/api/auth/login', json={'email': data['email'], 'password': data['password']}).json()


@pytest.fixture()
def admin(client, db):
    create_account(db, Registration(email='admin@example.com', first_name='Admin', last_name='User', password='AdminPass123', confirm_password='AdminPass123'), 'admin')
    return client.post('/api/auth/login', json={'email': 'admin@example.com', 'password': 'AdminPass123'}).json()


def headers(result):
    return {'Authorization': f"Bearer {result['access_token']}"}
