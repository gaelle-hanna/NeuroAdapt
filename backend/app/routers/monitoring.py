from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import require_role
from app.models import User, Assignment
from app.services.accounts import profile_view
from app.services.medications import authorize_patient, history, medications

router = APIRouter(prefix='/monitoring', tags=['Professional monitoring'])
professional = require_role('professional')


@router.get('/patients')
def patients(user=Depends(professional), db: Session = Depends(get_db)):
    users = db.scalars(select(User).join(Assignment, Assignment.PatientID == User.UserID).where(
        Assignment.ProfessionalID == user.UserID, Assignment.Status == 'active',
        Assignment.UnassignedAt.is_(None), User.Status == 'active').order_by(User.UserID)).all()
    result = []
    for u in users:
        records = history(db, u.UserID)
        result.append(dict(**profile_view(db, u), record_count=len(records), last_intake=records[0]['taken_at'] if records else None))
    return result


@router.get('/patients/{patient_id}')
def detail(patient_id: int, user=Depends(professional), db: Session = Depends(get_db)):
    authorize_patient(db, user.UserID, patient_id)
    return dict(profile=profile_view(db, db.get(User, patient_id)), medications=medications(db, patient_id), history=history(db, patient_id))


@router.get('/patients/{patient_id}/history')
def patient_history(patient_id: int, user=Depends(professional), db: Session = Depends(get_db)):
    authorize_patient(db, user.UserID, patient_id)
    return history(db, patient_id)
