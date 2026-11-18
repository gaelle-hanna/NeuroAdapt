"""Explicit, local-only account bootstrap and fictitious demo data."""
import argparse
import getpass
import os
from datetime import timedelta
from pydantic import ValidationError
from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import select
from app.database import SessionLocal
from app.models import User, Medication, Intake, Assignment, now
from app.schemas import Registration, CreateProfessional
from app.services.accounts import create_account, commit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['create-admin', 'seed-demo'])
    args = parser.parse_args()
    with SessionLocal() as db:
        if args.command == 'create-admin':
            email = os.environ.get('ADMIN_EMAIL') or input('Administrator email: ')
            password = os.environ.get('ADMIN_PASSWORD') or getpass.getpass('Administrator password: ')
            confirmation = password if os.environ.get('ADMIN_PASSWORD') else getpass.getpass('Confirm password: ')
            data = Registration(email=email, password=password, confirm_password=confirmation, first_name='Administrator', last_name='Account')
            create_account(db, data, 'admin')
            print('Administrator created. No credentials have been logged.')
        else:
            from app.core.config import settings
            if settings.environment != 'development':
                raise SystemExit('Demo data is permitted only in development.')
            password = getpass.getpass('Choose a password for the fictitious demo accounts: ')
            if db.scalar(select(User).where(User.Email.in_(['patient@example.com', 'professional@example.com']))):
                raise SystemExit('Demo accounts already exist; no changes made.')
            patient = create_account(db, Registration(email='patient@example.com', password=password, confirm_password=password, first_name='Demo', last_name='Patient'))
            pro = create_account(db, CreateProfessional(email='professional@example.com', password=password, confirm_password=password, first_name='Demo', last_name='Professional', specialization='Neurology', license_number='DEMO-ONLY-001', phone='+961 70000000', workplace='Fictitious demo clinic'), 'professional')
            m = Medication(PatientID=patient.UserID, MedicationName='Demo medication', Dosage='Demo dosage', Frequency='Demo frequency', Instructions='Fictitious demonstration entry only.')
            db.add(m)
            db.flush()
            db.add(Intake(MedicationID=m.MedicationID, TakenAt=now() - timedelta(hours=1), Notes='Fictitious demonstration record.'))
            db.add(Assignment(PatientID=patient.UserID, ProfessionalID=pro.UserID))
            commit(db)
            print('Fictitious demo accounts created: patient@example.com and professional@example.com')


def run():
    try:
        main()
    except ValidationError as exc:
        # Never stringify ValidationError: it includes raw credential input.
        messages = []
        for error in exc.errors(include_input=False, include_context=False, include_url=False):
            field = '.'.join(map(str, error['loc'])) or 'Account'
            messages.append(f"{field}: {error['msg']}")
        raise SystemExit('Account not created. ' + '; '.join(messages)) from None
    except HTTPException as exc:
        raise SystemExit(f'Account operation failed: {exc.detail}') from None
    except SQLAlchemyError:
        raise SystemExit('Cannot access the database. Start MariaDB and check backend/.env.') from None


if __name__ == '__main__':
    run()
