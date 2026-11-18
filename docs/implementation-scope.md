# NeuroAdapt implementation scope

The implementation covers patient registration; patient, healthcare professional, and administrator login; password reset; patient and professional profiles; patient-owned medication management and intake recording; medication history; professional monitoring of actively assigned patients; and supporting administrator account and assignment management.

The proposal was read for context. All six activity-diagram XML files were parsed, including their validation, empty, authorization, and error branches. The architecture and database JPEGs and all 18 numbered UI PNGs were inspected. The final ERD supplies the seven application tables and their exact attribute names, lengths, and types. The original source documents are preserved.

## Source precedence

Selected scope takes precedence over activity diagrams, followed by the final ERD, architecture, screenshots, and full proposal. Screenshots remain the visual authority. Hardware, motor measurements, rehabilitation sessions, games, AI, and clinical prescribing are excluded.

## Small UI corrections

- Preserve the blue split authentication layout, white sidebar and header, pale background, navy headings, rounded cards, controls, and table styling.
- Compute displayed names, initials, medication values, dates, counts, status, and assignments from API data. Do not copy fictional screenshot records.
- Display confirmation only after an API request succeeds. Remove screenshot instructions such as “After saving” and implementation notes about empty tables.
- Add medication management using matching forms and tables. The no-medications state links to this workflow rather than implying that the professional issues prescriptions.
- Add a professional-profile form by extending the patient-profile style with ERD fields. Include patient date of birth and address, absent from the screenshot.
- Public registration creates patients only. Administrator “Add user” is labeled “Add professional.” Administrators can edit professional details and change patient/professional account status.
- Use accurate initials for each account. Add logout, usable help, accessible labels, keyboard focus, and responsive navigation.
- Do not offer an administrator personal profile: the ERD contains no administrator profile table. The administrator sidebar consistently shows Dashboard, Manage Users, and Assignments.
- Render required validation messages and loading/error/empty states dynamically. Preserve desktop identity on smaller screens with stacked forms and horizontally scrollable tables.
- Registration copy refers to medication history rather than excluded rehabilitation information.

## Workflow and database decisions

- All seven tables and ERD columns are retained without extra application tables or columns. Alembic adds its standard migration-version metadata table; this is tooling metadata, not an eighth domain entity.
- Database role values are `patient`, `professional`, `admin`; account and assignment status values are `active`, `inactive`. Accounts are created with their corresponding profile in a transaction. Role changes and public professional/admin creation are not exposed.
- Email addresses are normalized to lowercase. License numbers and emails are unique. Optional patient fields may be null; names are required.
- SQL DATETIME values store UTC. API intake timestamps require an explicit timezone and return UTC; the browser renders local dates/times. Future intake dates are rejected.
- A deactivated medication remains available in history. Editing a medication changes its description in prior history because the ERD links intake records directly to the medication and has no dosage snapshot field.
- Assignment creation locks the patient account and professional account before checking for an active pair. This prevents duplicate active pairs through supported API operations without changing the ERD and retains deactivated historical rows. Direct SQL imports must follow the same business rule.
- Professional access requires both an active assignment and an active patient account. Account status is checked on every authenticated request.
- Password reset returns a generic public message, overriding the diagram's email-not-found branch according to the explicit security requirement. Tokens are random, SHA-256 hashed in storage, expire after 30 minutes, and are consumed once under transaction locks.
- Reset links use URL fragments, which are not sent to HTTP access logs. In development only, `DEV_RESET_LINKS=true` allows the link in the response/UI when SMTP is absent. This deliberately reveals account existence in that explicitly enabled local mode; keep it disabled on shared environments. Production configuration rejects that setting and requires SMTP.
- JWTs expire after 30 minutes and include a keyed password-hash fingerprint to invalidate old sessions after password reset. Logout clears browser session storage. It does not revoke an independently copied JWT; a persistent revocation design is outside this ERD.
- Login, registration, and reset operations have bounded process-local rate limiting. Deploy one API worker for this prototype; replace with shared limiting before scaling. Forwarded headers are not trusted for rate-limit identity by this code.

## Verification limits

See `docs/verification.md` for executed checks and remaining environment dependencies. SQLite is used only by isolated automated tests, never as an application fallback. MariaDB integration and browser end-to-end scenarios require an installed, configured server and frontend dependencies.

## Role-specific onboarding update

Account creation now requires date of birth, contact phone, and address for patients (public registration and administrator creation). Healthcare professional creation requires specialization, professional license number, contact phone, and workplace. Forms group personal and role-specific information using the existing visual style. Phone values must contain 7 to 15 digits; patient birth dates cannot be in the future. The existing ERD columns store these values; no database migration is needed. Existing accounts are preserved, and optional fields on profile editing remain compatible with older incomplete profiles. Public professional registration remains disabled. License information is recorded, not externally verified. No diagnoses, disease staging, or clinical assessments have been added outside the documented schema.
