from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import require_role
from app.models import Medication, Intake
from app.schemas import MedicationInput, IntakeInput
from app.services.medications import medications, history, own_medication, medication_view
from app.services.accounts import commit

router = APIRouter(prefix='/medications', tags=['Medications'])
patient = require_role('patient')


@router.get('')
def list_medications(user=Depends(patient), db: Session = Depends(get_db)):
    return medications(db, user.UserID)


def apply_medication(m, data):
    for field, attr in [('medication_name', 'MedicationName'), ('dosage', 'Dosage'), ('frequency', 'Frequency'), ('instructions', 'Instructions'), ('is_active', 'IsActive')]:
        setattr(m, attr, getattr(data, field))


@router.post('', status_code=201)
def add(data: MedicationInput, user=Depends(patient), db: Session = Depends(get_db)):
    m = Medication(PatientID=user.UserID)
    apply_medication(m, data)
    db.add(m)
    commit(db)
    return medication_view(m)


@router.put('/{medication_id}')
def edit(medication_id: int, data: MedicationInput, user=Depends(patient), db: Session = Depends(get_db)):
    m = own_medication(db, medication_id, user.UserID, lock=True)
    apply_medication(m, data)
    commit(db)
    return medication_view(m)


@router.post('/intakes', status_code=201)
def record(data: IntakeInput, user=Depends(patient), db: Session = Depends(get_db)):
    m = own_medication(db, data.medication_id, user.UserID, lock=True)
    if not m.IsActive:
        raise HTTPException(400, 'This medication is inactive.')
    intake = Intake(MedicationID=m.MedicationID, TakenAt=data.taken_at, Notes=data.notes)
    db.add(intake)
    commit(db)
    return {'id': intake.IntakeID, 'message': 'Medication intake saved successfully.'}


@router.get('/intakes/history')
def get_history(user=Depends(patient), db: Session = Depends(get_db)):
    return history(db, user.UserID)
