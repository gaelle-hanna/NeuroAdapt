import re
from datetime import date, datetime, timezone
from typing import Annotated, Literal
from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator, model_validator

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Password = Annotated[str, StringConstraints(min_length=10, max_length=128)]


def validate_phone(value: str) -> str:
    value = value.strip(' ')
    if not re.fullmatch(r'\+?(?:[ ()-]*[0-9]){7,15}[ ()-]*', value):
        raise ValueError('Enter a contact phone number with 7 to 15 digits')
    # Keep familiar formatting when it fits the existing VARCHAR(20).
    if len(value) <= 20:
        return value
    return re.sub(r'[ ()-]', '', value)


Phone = Annotated[str, StringConstraints(strip_whitespace=False), AfterValidator(validate_phone)]


class Input(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class Credentials(Input):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=False)
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=1, max_length=128)


class NewPassword(Input):
    # Password whitespace is significant; do not trim passwords.
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=False)
    password: Password
    confirm_password: str

    @model_validator(mode='after')
    def matches(self):
        if self.password != self.confirm_password:
            raise ValueError('Passwords must match')
        if not any(c.isalpha() for c in self.password) or not any(c.isdigit() for c in self.password):
            raise ValueError('Use at least 10 characters including a letter and a number')
        return self


class Registration(NewPassword):
    email: EmailStr = Field(max_length=255)
    first_name: Name
    last_name: Name


class ForgotPassword(Input):
    email: EmailStr = Field(max_length=255)


class ResetPassword(NewPassword):
    token: str = Field(min_length=20, max_length=256)


class Profile(Input):
    first_name: Name
    last_name: Name
    email: EmailStr = Field(max_length=255)
    phone: Phone | None = None


class PatientProfile(Profile):
    date_of_birth: date | None = None
    address: str | None = Field(default=None, max_length=255)

    @field_validator('date_of_birth')
    @classmethod
    def past_birth(cls, v):
        if v and v < date(1900, 1, 1):
            raise ValueError('Date of birth must be on or after January 1, 1900')
        if v and v > date.today():
            raise ValueError('Date of birth cannot be in the future')
        return v


class CreatePatient(Registration, PatientProfile):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=False)
    date_of_birth: date
    phone: Phone
    address: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]


class ProfessionalProfile(Profile):
    phone: Phone
    specialization: Name
    license_number: Name
    workplace: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)]


class CreateProfessional(Registration):
    specialization: Name
    license_number: Name
    phone: Phone
    workplace: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)]


class MedicationInput(Input):
    medication_name: str = Field(min_length=1, max_length=150)
    dosage: Name
    frequency: Name
    instructions: str | None = Field(default=None, max_length=5000)
    is_active: bool = True


class IntakeInput(Input):
    medication_id: int = Field(gt=0)
    taken_at: datetime
    notes: str | None = Field(default=None, max_length=5000)

    @field_validator('taken_at')
    @classmethod
    def valid_time(cls, v):
        if not v.tzinfo:
            raise ValueError('Intake time must include a timezone')
        v = v.astimezone(timezone.utc).replace(tzinfo=None)
        if v > datetime.utcnow():
            raise ValueError('Intake time cannot be in the future')
        if v.year < 1900:
            raise ValueError('Enter a valid intake date')
        return v


class StatusInput(Input):
    status: Literal['active', 'inactive']


class AssignmentInput(Input):
    patient_id: int = Field(gt=0)
    professional_id: int = Field(gt=0)
