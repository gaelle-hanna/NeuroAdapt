from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import current_user, require_role
from app.schemas import PatientProfile, ProfessionalProfile
from app.services.accounts import profile_view, update_profile

router = APIRouter(prefix='/profiles', tags=['Profiles'])


@router.get('/me')
def get_profile(user=Depends(current_user), db: Session = Depends(get_db)):
    return profile_view(db, user)


@router.put('/patient')
def update_patient(data: PatientProfile, user=Depends(require_role('patient')), db: Session = Depends(get_db)):
    return update_profile(db, user, data)


@router.put('/professional')
def update_professional(data: ProfessionalProfile, user=Depends(require_role('professional')), db: Session = Depends(get_db)):
    return update_profile(db, user, data)
