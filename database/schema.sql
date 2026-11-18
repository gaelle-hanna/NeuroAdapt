CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 0001

CREATE TABLE `USERS` (
    `UserID` INTEGER NOT NULL AUTO_INCREMENT, 
    `Email` VARCHAR(255) NOT NULL, 
    `PasswordHash` VARCHAR(255) NOT NULL, 
    `Role` VARCHAR(20) NOT NULL, 
    `Status` VARCHAR(20) NOT NULL, 
    `CreatedAt` DATETIME NOT NULL, 
    `UpdatedAt` DATETIME NOT NULL, 
    PRIMARY KEY (`UserID`), 
    CONSTRAINT ck_users_role CHECK (Role IN ('patient','professional','admin')), 
    CONSTRAINT ck_users_status CHECK (Status IN ('active','inactive')), 
    UNIQUE (`Email`)
)ENGINE=InnoDB CHARSET=utf8mb4;

CREATE TABLE `PATIENT_PROFILES` (
    `PatientID` INTEGER NOT NULL, 
    `FirstName` VARCHAR(100) NOT NULL, 
    `LastName` VARCHAR(100) NOT NULL, 
    `DateOfBirth` DATE, 
    `Phone` VARCHAR(20), 
    `Address` VARCHAR(255), 
    `UpdatedAt` DATETIME NOT NULL, 
    PRIMARY KEY (`PatientID`), 
    FOREIGN KEY(`PatientID`) REFERENCES `USERS` (`UserID`) ON DELETE RESTRICT
)ENGINE=InnoDB CHARSET=utf8mb4;

CREATE TABLE `PROFESSIONAL_PROFILES` (
    `ProfessionalID` INTEGER NOT NULL, 
    `FirstName` VARCHAR(100) NOT NULL, 
    `LastName` VARCHAR(100) NOT NULL, 
    `Specialization` VARCHAR(100) NOT NULL, 
    `LicenseNumber` VARCHAR(100) NOT NULL, 
    `Phone` VARCHAR(20), 
    `Workplace` VARCHAR(150), 
    `UpdatedAt` DATETIME NOT NULL, 
    PRIMARY KEY (`ProfessionalID`), 
    FOREIGN KEY(`ProfessionalID`) REFERENCES `USERS` (`UserID`) ON DELETE RESTRICT, 
    UNIQUE (`LicenseNumber`)
)ENGINE=InnoDB CHARSET=utf8mb4;

CREATE TABLE `PASSWORD_RESET_TOKENS` (
    `ResetID` INTEGER NOT NULL AUTO_INCREMENT, 
    `UserID` INTEGER NOT NULL, 
    `TokenHash` VARCHAR(255) NOT NULL, 
    `ExpiresAt` DATETIME NOT NULL, 
    `UsedAt` DATETIME, 
    `CreatedAt` DATETIME NOT NULL, 
    PRIMARY KEY (`ResetID`), 
    FOREIGN KEY(`UserID`) REFERENCES `USERS` (`UserID`) ON DELETE CASCADE, 
    UNIQUE (`TokenHash`)
)ENGINE=InnoDB CHARSET=utf8mb4;

CREATE TABLE `MEDICATIONS` (
    `MedicationID` INTEGER NOT NULL AUTO_INCREMENT, 
    `PatientID` INTEGER NOT NULL, 
    `MedicationName` VARCHAR(150) NOT NULL, 
    `Dosage` VARCHAR(100) NOT NULL, 
    `Frequency` VARCHAR(100) NOT NULL, 
    `Instructions` TEXT, 
    `IsActive` BOOL NOT NULL, 
    PRIMARY KEY (`MedicationID`), 
    FOREIGN KEY(`PatientID`) REFERENCES `PATIENT_PROFILES` (`PatientID`) ON DELETE RESTRICT
)ENGINE=InnoDB CHARSET=utf8mb4;

CREATE TABLE `MEDICATION_INTAKES` (
    `IntakeID` INTEGER NOT NULL AUTO_INCREMENT, 
    `MedicationID` INTEGER NOT NULL, 
    `TakenAt` DATETIME NOT NULL, 
    `Notes` TEXT, 
    `CreatedAt` DATETIME NOT NULL, 
    PRIMARY KEY (`IntakeID`), 
    FOREIGN KEY(`MedicationID`) REFERENCES `MEDICATIONS` (`MedicationID`) ON DELETE RESTRICT
)ENGINE=InnoDB CHARSET=utf8mb4;

CREATE TABLE `PATIENT_PROFESSIONALS` (
    `AssignmentID` INTEGER NOT NULL AUTO_INCREMENT, 
    `PatientID` INTEGER NOT NULL, 
    `ProfessionalID` INTEGER NOT NULL, 
    `AssignedAt` DATETIME NOT NULL, 
    `UnassignedAt` DATETIME, 
    `Status` VARCHAR(20) NOT NULL, 
    PRIMARY KEY (`AssignmentID`), 
    CONSTRAINT ck_assignment_status CHECK (Status IN ('active','inactive')), 
    CONSTRAINT ck_assignment_dates CHECK ((Status = 'active' AND UnassignedAt IS NULL) OR (Status = 'inactive' AND UnassignedAt IS NOT NULL)), 
    FOREIGN KEY(`PatientID`) REFERENCES `PATIENT_PROFILES` (`PatientID`) ON DELETE RESTRICT, 
    FOREIGN KEY(`ProfessionalID`) REFERENCES `PROFESSIONAL_PROFILES` (`ProfessionalID`) ON DELETE RESTRICT
)ENGINE=InnoDB CHARSET=utf8mb4;

CREATE INDEX `ix_PASSWORD_RESET_TOKENS_UserID` ON `PASSWORD_RESET_TOKENS` (`UserID`);

CREATE INDEX `ix_MEDICATIONS_PatientID` ON `MEDICATIONS` (`PatientID`);

CREATE INDEX `ix_MEDICATION_INTAKES_MedicationID` ON `MEDICATION_INTAKES` (`MedicationID`);

CREATE INDEX `ix_MEDICATION_INTAKES_TakenAt` ON `MEDICATION_INTAKES` (`TakenAt`);

CREATE INDEX `ix_PATIENT_PROFESSIONALS_PatientID` ON `PATIENT_PROFESSIONALS` (`PatientID`);

CREATE INDEX `ix_PATIENT_PROFESSIONALS_ProfessionalID` ON `PATIENT_PROFESSIONALS` (`ProfessionalID`);

INSERT INTO alembic_version (version_num) VALUES ('0001');

