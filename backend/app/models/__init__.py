from datetime import datetime
from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import mapped_column
from app.database import Base


def now():
    return datetime.utcnow()


class User(Base):
    __tablename__ = 'USERS'
    UserID = mapped_column(Integer, primary_key=True)
    Email = mapped_column(String(255), unique=True, nullable=False)
    PasswordHash = mapped_column(String(255), nullable=False)
    Role = mapped_column(String(20), nullable=False)
    Status = mapped_column(String(20), nullable=False, default='active')
    CreatedAt = mapped_column(DateTime, nullable=False, default=now)
    UpdatedAt = mapped_column(DateTime, nullable=False, default=now, onupdate=now)
    __table_args__ = (CheckConstraint("Role IN ('patient','professional','admin')"), CheckConstraint("Status IN ('active','inactive')"))


class Patient(Base):
    __tablename__ = 'PATIENT_PROFILES'
    PatientID = mapped_column(ForeignKey('USERS.UserID', ondelete='RESTRICT'), primary_key=True)
    FirstName = mapped_column(String(100), nullable=False)
    LastName = mapped_column(String(100), nullable=False)
    DateOfBirth = mapped_column(Date)
    Phone = mapped_column(String(20))
    Address = mapped_column(String(255))
    UpdatedAt = mapped_column(DateTime, nullable=False, default=now, onupdate=now)


class Professional(Base):
    __tablename__ = 'PROFESSIONAL_PROFILES'
    ProfessionalID = mapped_column(ForeignKey('USERS.UserID', ondelete='RESTRICT'), primary_key=True)
    FirstName = mapped_column(String(100), nullable=False)
    LastName = mapped_column(String(100), nullable=False)
    Specialization = mapped_column(String(100), nullable=False)
    LicenseNumber = mapped_column(String(100), unique=True, nullable=False)
    Phone = mapped_column(String(20))
    Workplace = mapped_column(String(150))
    UpdatedAt = mapped_column(DateTime, nullable=False, default=now, onupdate=now)


class ResetToken(Base):
    __tablename__ = 'PASSWORD_RESET_TOKENS'
    ResetID = mapped_column(Integer, primary_key=True)
    UserID = mapped_column(ForeignKey('USERS.UserID', ondelete='CASCADE'), nullable=False, index=True)
    TokenHash = mapped_column(String(255), unique=True, nullable=False)
    ExpiresAt = mapped_column(DateTime, nullable=False)
    UsedAt = mapped_column(DateTime)
    CreatedAt = mapped_column(DateTime, nullable=False, default=now)


class Medication(Base):
    __tablename__ = 'MEDICATIONS'
    MedicationID = mapped_column(Integer, primary_key=True)
    PatientID = mapped_column(ForeignKey('PATIENT_PROFILES.PatientID', ondelete='RESTRICT'), nullable=False, index=True)
    MedicationName = mapped_column(String(150), nullable=False)
    Dosage = mapped_column(String(100), nullable=False)
    Frequency = mapped_column(String(100), nullable=False)
    Instructions = mapped_column(Text)
    IsActive = mapped_column(Boolean, nullable=False, default=True)


class Intake(Base):
    __tablename__ = 'MEDICATION_INTAKES'
    IntakeID = mapped_column(Integer, primary_key=True)
    MedicationID = mapped_column(ForeignKey('MEDICATIONS.MedicationID', ondelete='RESTRICT'), nullable=False, index=True)
    TakenAt = mapped_column(DateTime, nullable=False, index=True)
    Notes = mapped_column(Text)
    CreatedAt = mapped_column(DateTime, nullable=False, default=now)


class Assignment(Base):
    __tablename__ = 'PATIENT_PROFESSIONALS'
    AssignmentID = mapped_column(Integer, primary_key=True)
    PatientID = mapped_column(ForeignKey('PATIENT_PROFILES.PatientID', ondelete='RESTRICT'), nullable=False, index=True)
    ProfessionalID = mapped_column(ForeignKey('PROFESSIONAL_PROFILES.ProfessionalID', ondelete='RESTRICT'), nullable=False, index=True)
    AssignedAt = mapped_column(DateTime, nullable=False, default=now)
    UnassignedAt = mapped_column(DateTime)
    Status = mapped_column(String(20), nullable=False, default='active')
    __table_args__ = (CheckConstraint("Status IN ('active','inactive')"), CheckConstraint("(Status = 'active' AND UnassignedAt IS NULL) OR (Status = 'inactive' AND UnassignedAt IS NOT NULL)"))
