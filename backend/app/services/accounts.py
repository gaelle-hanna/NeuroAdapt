from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.models import User, Patient, Professional
from app.core.security import hasher


def commit(db):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'This email, license number, or assignment already exists.')


def create_account(db, data, role='patient'):
    user = User(Email=str(data.email).strip().lower(), PasswordHash=hasher.hash(data.password), Role=role)
    db.add(user)
    try:
        db.flush()
        common = dict(FirstName=data.first_name.strip(), LastName=data.last_name.strip())
        if role == 'patient':
            db.add(Patient(PatientID=user.UserID, Phone=getattr(data, 'phone', None),
                           DateOfBirth=getattr(data, 'date_of_birth', None),
                           Address=getattr(data, 'address', None), **common))
        elif role == 'professional':
            db.add(Professional(ProfessionalID=user.UserID, Specialization=data.specialization,
                                LicenseNumber=data.license_number, Phone=data.phone, Workplace=data.workplace, **common))
        commit(db)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Email or professional license number already registered.')
    return user


def user_view(db, user):
    profile = db.get(Patient if user.Role == 'patient' else Professional, user.UserID) if user.Role != 'admin' else None
    return dict(id=user.UserID, email=user.Email, role=user.Role, status=user.Status,
                first_name=profile.FirstName if profile else 'Administrator', last_name=profile.LastName if profile else '')


def profile_view(db, user):
    result = user_view(db, user)
    if user.Role == 'admin':
        return result
    p = db.get(Patient if user.Role == 'patient' else Professional, user.UserID)
    result['phone'] = p.Phone
    if user.Role == 'patient':
        result.update(date_of_birth=p.DateOfBirth, address=p.Address)
    else:
        result.update(specialization=p.Specialization, license_number=p.LicenseNumber, workplace=p.Workplace)
    return result


def update_profile(db, user, data):
    p = db.get(Patient if user.Role == 'patient' else Professional, user.UserID)
    user.Email = str(data.email).lower()
    p.FirstName, p.LastName, p.Phone = data.first_name, data.last_name, data.phone
    if user.Role == 'patient':
        p.DateOfBirth, p.Address = data.date_of_birth, data.address
    else:
        p.Specialization, p.LicenseNumber, p.Workplace = data.specialization, data.license_number, data.workplace
    commit(db)
    return profile_view(db, user)
