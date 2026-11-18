from sqlalchemy import select
from fastapi import HTTPException
from app.models import Medication, Intake, Assignment, User


def medication_view(m):
    return dict(id=m.MedicationID, medication_name=m.MedicationName, dosage=m.Dosage, frequency=m.Frequency,
                instructions=m.Instructions, is_active=m.IsActive)


def medications(db, patient_id):
    return [medication_view(m) for m in db.scalars(select(Medication).where(Medication.PatientID == patient_id).order_by(Medication.MedicationName))]


def history(db, patient_id):
    rows = db.execute(select(Intake, Medication).join(Medication).where(Medication.PatientID == patient_id)
                      .order_by(Intake.TakenAt.desc(), Intake.IntakeID.desc())).all()
    return [dict(id=i.IntakeID, medication_id=m.MedicationID, medication_name=m.MedicationName,
                 dosage=m.Dosage, taken_at=i.TakenAt.isoformat() + 'Z', notes=i.Notes) for i, m in rows]


def own_medication(db, medication_id, patient_id, lock=False):
    q = select(Medication).where(Medication.MedicationID == medication_id, Medication.PatientID == patient_id)
    m = db.scalar(q.with_for_update() if lock else q)
    if not m:
        raise HTTPException(404, 'Medication not found in your account.')
    return m


def authorize_patient(db, professional_id, patient_id):
    assignment = db.scalar(select(Assignment).join(User, User.UserID == Assignment.PatientID).where(
        Assignment.PatientID == patient_id, Assignment.ProfessionalID == professional_id,
        Assignment.Status == 'active', Assignment.UnassignedAt.is_(None), User.Status == 'active'))
    if not assignment:
        raise HTTPException(403, 'Access denied. You can only view active patients assigned to your account.')
