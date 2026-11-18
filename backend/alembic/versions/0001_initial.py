"""Seven-table NeuroAdapt ERD. Frozen schema, independent of later ORM changes."""
from alembic import op
import sqlalchemy as sa

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('USERS', sa.Column('UserID', sa.Integer, primary_key=True), sa.Column('Email', sa.String(255), nullable=False, unique=True),
                    sa.Column('PasswordHash', sa.String(255), nullable=False), sa.Column('Role', sa.String(20), nullable=False),
                    sa.Column('Status', sa.String(20), nullable=False), sa.Column('CreatedAt', sa.DateTime, nullable=False), sa.Column('UpdatedAt', sa.DateTime, nullable=False),
                    sa.CheckConstraint("Role IN ('patient','professional','admin')", name='ck_users_role'), sa.CheckConstraint("Status IN ('active','inactive')", name='ck_users_status'), mysql_engine='InnoDB', mysql_charset='utf8mb4')
    op.create_table('PATIENT_PROFILES', sa.Column('PatientID', sa.Integer, sa.ForeignKey('USERS.UserID', ondelete='RESTRICT'), primary_key=True),
                    sa.Column('FirstName', sa.String(100), nullable=False), sa.Column('LastName', sa.String(100), nullable=False), sa.Column('DateOfBirth', sa.Date),
                    sa.Column('Phone', sa.String(20)), sa.Column('Address', sa.String(255)), sa.Column('UpdatedAt', sa.DateTime, nullable=False), mysql_engine='InnoDB', mysql_charset='utf8mb4')
    op.create_table('PROFESSIONAL_PROFILES', sa.Column('ProfessionalID', sa.Integer, sa.ForeignKey('USERS.UserID', ondelete='RESTRICT'), primary_key=True),
                    sa.Column('FirstName', sa.String(100), nullable=False), sa.Column('LastName', sa.String(100), nullable=False),
                    sa.Column('Specialization', sa.String(100), nullable=False), sa.Column('LicenseNumber', sa.String(100), nullable=False, unique=True),
                    sa.Column('Phone', sa.String(20)), sa.Column('Workplace', sa.String(150)), sa.Column('UpdatedAt', sa.DateTime, nullable=False), mysql_engine='InnoDB', mysql_charset='utf8mb4')
    op.create_table('PASSWORD_RESET_TOKENS', sa.Column('ResetID', sa.Integer, primary_key=True), sa.Column('UserID', sa.Integer, sa.ForeignKey('USERS.UserID', ondelete='CASCADE'), nullable=False),
                    sa.Column('TokenHash', sa.String(255), nullable=False, unique=True), sa.Column('ExpiresAt', sa.DateTime, nullable=False), sa.Column('UsedAt', sa.DateTime), sa.Column('CreatedAt', sa.DateTime, nullable=False), mysql_engine='InnoDB', mysql_charset='utf8mb4')
    op.create_table('MEDICATIONS', sa.Column('MedicationID', sa.Integer, primary_key=True), sa.Column('PatientID', sa.Integer, sa.ForeignKey('PATIENT_PROFILES.PatientID', ondelete='RESTRICT'), nullable=False),
                    sa.Column('MedicationName', sa.String(150), nullable=False), sa.Column('Dosage', sa.String(100), nullable=False), sa.Column('Frequency', sa.String(100), nullable=False),
                    sa.Column('Instructions', sa.Text), sa.Column('IsActive', sa.Boolean, nullable=False), mysql_engine='InnoDB', mysql_charset='utf8mb4')
    op.create_table('MEDICATION_INTAKES', sa.Column('IntakeID', sa.Integer, primary_key=True), sa.Column('MedicationID', sa.Integer, sa.ForeignKey('MEDICATIONS.MedicationID', ondelete='RESTRICT'), nullable=False),
                    sa.Column('TakenAt', sa.DateTime, nullable=False), sa.Column('Notes', sa.Text), sa.Column('CreatedAt', sa.DateTime, nullable=False), mysql_engine='InnoDB', mysql_charset='utf8mb4')
    op.create_table('PATIENT_PROFESSIONALS', sa.Column('AssignmentID', sa.Integer, primary_key=True), sa.Column('PatientID', sa.Integer, sa.ForeignKey('PATIENT_PROFILES.PatientID', ondelete='RESTRICT'), nullable=False),
                    sa.Column('ProfessionalID', sa.Integer, sa.ForeignKey('PROFESSIONAL_PROFILES.ProfessionalID', ondelete='RESTRICT'), nullable=False),
                    sa.Column('AssignedAt', sa.DateTime, nullable=False), sa.Column('UnassignedAt', sa.DateTime), sa.Column('Status', sa.String(20), nullable=False),
                    sa.CheckConstraint("Status IN ('active','inactive')", name='ck_assignment_status'),
                    sa.CheckConstraint("(Status = 'active' AND UnassignedAt IS NULL) OR (Status = 'inactive' AND UnassignedAt IS NOT NULL)", name='ck_assignment_dates'), mysql_engine='InnoDB', mysql_charset='utf8mb4')
    for table, columns in {'PASSWORD_RESET_TOKENS': ['UserID'], 'MEDICATIONS': ['PatientID'], 'MEDICATION_INTAKES': ['MedicationID', 'TakenAt'], 'PATIENT_PROFESSIONALS': ['PatientID', 'ProfessionalID']}.items():
        for column in columns:
            op.create_index(f'ix_{table}_{column}', table, [column])


def downgrade():
    for table in ['PATIENT_PROFESSIONALS', 'MEDICATION_INTAKES', 'MEDICATIONS', 'PASSWORD_RESET_TOKENS', 'PROFESSIONAL_PROFILES', 'PATIENT_PROFILES', 'USERS']:
        op.drop_table(table)
