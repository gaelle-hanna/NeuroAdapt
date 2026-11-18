from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import require_role
from app.models import User, Patient, Professional, Assignment, now
from app.schemas import CreatePatient, CreateProfessional, StatusInput, AssignmentInput, ProfessionalProfile
from app.services.accounts import create_account, user_view, profile_view, update_profile, commit

router = APIRouter(prefix='/admin', tags=['Administration'], dependencies=[Depends(require_role('admin'))])


@router.get('/users')
def users(db: Session = Depends(get_db)):
    return [profile_view(db, u) for u in db.scalars(select(User).order_by(User.UserID))]


@router.post('/professionals', status_code=201)
def create_professional(data: CreateProfessional, db: Session = Depends(get_db)):
    return profile_view(db, create_account(db, data, 'professional'))


@router.post('/patients', status_code=201)
def create_patient(data: CreatePatient, db: Session = Depends(get_db)):
    return profile_view(db, create_account(db, data, 'patient'))


@router.put('/professionals/{professional_id}')
def edit_professional(professional_id: int, data: ProfessionalProfile, db: Session = Depends(get_db)):
    u = db.get(User, professional_id)
    if not u or u.Role != 'professional':
        raise HTTPException(404, 'Professional not found.')
    return update_profile(db, u, data)


@router.patch('/users/{user_id}/status')
def status(user_id: int, data: StatusInput, db: Session = Depends(get_db)):
    u = db.scalar(select(User).where(User.UserID == user_id).with_for_update())
    if not u:
        raise HTTPException(404, 'User not found.')
    if u.Role == 'admin':
        raise HTTPException(400, 'Administrator status cannot be changed here.')
    u.Status = data.status
    commit(db)
    return user_view(db, u)


@router.get('/assignments')
def assignments(db: Session = Depends(get_db)):
    return [dict(id=a.AssignmentID, patient_id=a.PatientID, professional_id=a.ProfessionalID,
                 patient=user_view(db, db.get(User, a.PatientID)), professional=user_view(db, db.get(User, a.ProfessionalID)),
                 assigned_at=a.AssignedAt, unassigned_at=a.UnassignedAt, status=a.Status)
            for a in db.scalars(select(Assignment).order_by(Assignment.AssignmentID.desc()))]


@router.post('/assignments', status_code=201)
def assign(data: AssignmentInput, db: Session = Depends(get_db)):
    # Always lock the patient first. Concurrent assignments for the same patient
    # serialize even when no assignment row exists yet, preserving the exact ERD.
    p = db.scalar(select(User).where(User.UserID == data.patient_id).with_for_update())
    pro = db.scalar(select(User).where(User.UserID == data.professional_id).with_for_update())
    if not p or p.Role != 'patient' or p.Status != 'active' or not pro or pro.Role != 'professional' or pro.Status != 'active':
        raise HTTPException(400, 'Select an active patient and healthcare professional.')
    existing = db.scalar(select(Assignment).where(Assignment.PatientID == p.UserID, Assignment.ProfessionalID == pro.UserID,
                                                Assignment.Status == 'active').with_for_update())
    if existing:
        raise HTTPException(409, 'An active assignment already exists for this pair.')
    a = Assignment(PatientID=p.UserID, ProfessionalID=pro.UserID)
    db.add(a)
    commit(db)
    return {'id': a.AssignmentID, 'message': 'Assignment saved successfully.'}


@router.delete('/assignments/{assignment_id}')
def unassign(assignment_id: int, db: Session = Depends(get_db)):
    a = db.scalar(select(Assignment).where(Assignment.AssignmentID == assignment_id).with_for_update())
    if not a:
        raise HTTPException(404, 'Assignment not found.')
    a.Status, a.UnassignedAt = 'inactive', a.UnassignedAt or now()
    commit(db)
    return {'message': 'Assignment deactivated. Historical records retained.'}
