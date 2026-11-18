# NeuroAdapt acceptance criteria audit

Of **249 parent acceptance criteria**, **233 passed**, **11 failed**, **3 were not tested**, and **2 were blocked**. The **169 child criteria** are reported separately. The existing suites passed all **49 tests** across backend, frontend components and browser workflows. Supplemental checks surfaced gaps that those tests did not exercise.

## Scope and verification

Audit date: 17 November 2026. Requirements came from the numbered G1–G6 work items supplied in chat and M1–M6 from the supplied work-item attachment. Each story has separate parent, Backend child and Frontend child tables. The summary counts parent criteria once per story and shows child totals separately. Child tasks that restate a parent requirement are audited independently and do not inflate parent totals.

Reviewed the React route guards, forms, API calls and state transitions, the FastAPI routers and services, Pydantic inputs, SQLAlchemy models, the initial Alembic migration, `database/schema.sql`, all six activity diagrams and all 18 Figma exports. Inspected the working tree as supplied. No application code or suites were edited.

**Status rules.** Implemented captures the observed implementation. Tested is **Pass** when execution or observed browser behavior supports the criterion, **Fail** when a required behavior was contradicted, **Not Tested** when coverage was absent or insufficient, and **Blocked** when key verification needed an unavailable dependency or reference. For design criteria, Pass means the core structure and flow were visually consistent, with differences documented below. It does not mean pixel equality. Shared validators, route guards and table components sometimes provide indirect coverage, indicated in the relevant rows. Existing automated coverage is identified by B, F or E/V test codes. R/U codes are supplemental executions. A criterion may pass with a documented variation, and a compound criterion can fail when only one part fails.

| Suite and command | Result | Environment and coverage |
| --- | --- | --- |
| Backend, from `backend`: `.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --tb=no --no-summary` | **33 passed**, one warning | Disposable SQLite memory fixtures with foreign keys enabled. The migration test uses a separate temporary SQLite file. |
| Frontend, from `frontend`: `node node_modules/vitest/vitest.mjs run --configLoader runner --reporter=dot` | **13 passed** | jsdom with mock API responses. The default esbuild config loader could not traverse a sandbox-restricted ancestor directory. The runner loader worked with the existing configuration. |
| Browser, from `frontend`: `node node_modules/playwright/cli.js test --trace off --output <audit-output>` | **3 passed**, including both workflows | Real Vite/FastAPI over loopback with Edge, a fresh SQLite file and synthetic accounts. The backend bootstrapped in test mode and enabled the local development reset link in that process only. Existing tests write screenshots under ignored `tmp/visual`. Trace recording was disabled so credentials and reset links were excluded from traces. |
| Supplemental API/database and Edge probes | R and U evidence below | Temporary data only. No live account or application database accessed. Browser network failures were simulated where noted. Post-commit GETs and targeted direct SQLite reads inspected persisted state without including values in this report. |
| Production MariaDB and SMTP | Unverified | No local disposable MariaDB listener/service was available. SQLite tests do not establish InnoDB concurrency behavior. No actual email was sent. |

### Existing automated evidence

| Code | File and test evidence |
| --- | --- |
| B1 | [test_workflows.py](../backend/tests/test_workflows.py) `test_registration_atomic_and_hashed`, `test_invalid_registration`. Verifies linked profile and Argon2 hash, duplicate/role override rejection and malformed inputs. The existing test does not force a profile insert to fail. |
| B2 | [test_role_registration.py](../backend/tests/test_role_registration.py) all cases. Required and invalid patient/professional details, and persisted profile fields. |
| B3 | [test_workflows.py](../backend/tests/test_workflows.py) `test_login_and_inactive_account`, `test_profile_and_role_protection`. Also [test_security.py](../backend/tests/test_security.py) `test_professional_profile_and_patient_deactivation` for professional edit. |
| B4 | [test_workflows.py](../backend/tests/test_workflows.py) `test_medication_intakes_and_ownership`. Empty history, medication/intake write, history contents, future intake, ownership and inactive medication with retained history. |
| B5 | [test_workflows.py](../backend/tests/test_workflows.py) `test_assignment_monitoring_lifecycle`. Existing account flows, empty list, active assign, duplicate, detail/history, deactivate, reassign and denied role. |
| B6 | [test_workflows.py](../backend/tests/test_workflows.py) `test_reset_tokens`, `test_reset_no_enumeration_and_rate_limit`. Valid, expired and reused links, hash-only storage, old session invalidation, new login, equal public responses and throttling. |
| B7 | [test_security.py](../backend/tests/test_security.py) all cases. Expired/invalid JWT, professional profile edit, inactive patient authorization, password whitespace and production reset config. |
| B8 | [test_admin_patients.py](../backend/tests/test_admin_patients.py) both cases. Admin creation, role and profile linkage, hash, login, duplicate and route protection. |
| B9 | [test_migrations.py](../backend/tests/test_migrations.py) initial migration round trip, and [test_cli.py](../backend/tests/test_cli.py) credential redaction on validation failure. Both executed in the full backend run. |
| F1 | [App.test.jsx](../frontend/src/App.test.jsx) patient and professional required role details, admin Add Patient endpoint wiring and confirmation mismatch. |
| F2 | [App.test.jsx](../frontend/src/App.test.jsx) login fields and register navigation, anonymous redirect, wrong role, API login error and successful action. |
| F3 | [App.test.jsx](../frontend/src/App.test.jsx) empty history, empty Record Medication, empty assigned-patient list and server retry feedback. |
| E1 | [workflows.spec.js](../tests/e2e/workflows.spec.js) patient registration/login, profile edit/reload, medication add, intake save, history, logout and reset/re-login. |
| E2 | [workflows.spec.js](../tests/e2e/workflows.spec.js) admin login, professional create, assignment, professional login, authorized monitoring and Access Denied. |
| V | [visual.spec.js](../tests/e2e/visual.spec.js) public auth views, registration at 390px and anonymous protected navigation. It writes screenshots but has no Figma baseline assertions. Despite its title, the test does not inject an API failure. V01–V18 below are manual comparisons and include supplemental screenshots/source checks. |

### Supplemental evidence

| Code | Executed check | Outcome |
| --- | --- | --- |
| R1–R4 | Public registration format/casefold/upper bound/class validation, login empty/format/unknown account and issued JWT TTL, positive identity and complete admin/professional route access matrix, own-profile identity/duplicate/validation/target ID | Pass |
| R5 | Profile PUT with punctuation-only phone | Fail. The update was accepted. |
| R6–R8 | Medication isolation and required-field API validation, intake timezone/ownership/ordering/persistence, medication edits and reversible status | Pass |
| R9 | Assignment missing/unknown/inactive and wrong-role selections, both account status transitions and administrator protection | Pass |
| R10 | Monitoring detail for nonexistent ID expected a missing-resource response | Fail. HTTP 403. |
| R11–R15 | Unassigned history denial, persisted assignment cardinalities and selected patient data, historical deactivation and reassign, inactive exclusion, administrator profile edit and duplicate/invalid requests | Pass |
| R16–R19 | Distinct reset issuance and stored 30-minute lifetime, invalid/missing token and password policy, old/new credentials, replacement hash and no remaining unused tokens | Pass |
| R20 | Registration with 15 digits plus allowed formatting exceeding 20 characters | Fail. HTTP 422. |
| R21 | Disposable SQLite trigger aborts the profile insert after user flush during public patient, admin patient and admin professional creation. Query USERS after all three failures. | Pass. All were rejected and zero orphan accounts remained. |
| U1–U4 | Browser required/malformed login, forgot navigation/input validation, invalid reset error, authenticated refresh and wrong-role pages | Pass |
| U5 | Direct medication-management link from Patient Dashboard | Fail. Only the indirect route is present. |
| U6–U8 | Real history fields/status/order and Asia/Beirut local rendering, 390px layout, role-specific patient form and Cancel | Pass |
| U9 | Medication edit updates saved state and leaves success notice visible | Fail on notice. The edit persisted. |
| U10–U12 | Deactivation/reactivation through UI and active dropdown gating, required intake controls, logout and return to protected URL | Pass |
| U13–U18 | Professional dashboard, name search and no results, monitoring profile/medications/notes, professional form field split, admin filters and assignment empty selections/history | Pass. U15 was rerun with the updated fixture frequency after the first assertion used its pre-edit value. |
| U19 | Reference 18 in-page validation for missing intake inputs | Fail. Native constraint feedback blocked the save; the reference banner did not appear. |
| U20–U28 | Future-date field feedback, refreshed dashboard with new intake, profile read/save failure, history/dashboard/professional loading and retry, admin live counts | Pass. Error checks used intercepted HTTP 503 responses. |
| U29/U29b | Admin deactivation/reactivation list update, then simulated failed status update after a success | List update passed. Old confirmation remained visible beside the error. |
| U30/U30b/U30c | Duplicate assignment error, successful UI deactivation, then simulated failed deactivation while previous confirmation was present | Duplicate and successful operations passed. Old confirmation remained visible beside the error. |


## Findings

### Confirmed defects

| ID | Criteria | Observed behavior | Suggested correction |
| --- | --- | --- | --- |
| D1 | G2-10, G2-B4, G2-F3 | In R5, the authenticated profile update accepted and persisted punctuation with zero phone digits. Account creation checks 7–15 digits, while both profile update schemas inherit a character pattern that accepts punctuation alone. | Validate the digit count when an optional phone value is supplied. Align the frontend validation with the backend and keep blank optional values supported if Q2 confirms they are optional. |
| D3 | G4-17 | In U9, editing worked and the changed frequency was subsequently visible, while the expected confirmation disappeared. The form is keyed by the edited record and unmounts when the handler clears the edit state. | Keep edit confirmation in the medication page state so it survives the form remount. |
| D5 | M4-13 | R10 got HTTP 403 for a nonexistent patient. The implementation uses the same assignment lookup for absent and unassigned patients. E2 also expects Access Denied when given a nonexistent ID, so the existing test preserves the current behavior. | Agree on missing-patient semantics and privacy tradeoffs. If 404 is required, explicitly distinguish the missing resource and update the UI and E2E expectation. |
| D8 | G1-9, M5-15 indirectly | R20 submitted a synthetically formatted 15-digit number using supported characters and got 422 because its formatted length exceeded 20. The frontend and schema cap input at 20 characters, and both profile tables allocate 20 characters. M5-15 only requires the digit count, so its create-flow digit-count check passed, with this shared format limitation recorded. | Define supported formatting precisely and normalize to a canonical representation before length checks/storage, or expand the storage and input limits together. |
| D10 | M5-29, M6-25, M6-F8 | U29b and U30c injected a failed request after a successful operation. The existing success notice stayed visible beside the new error. The medication activation handler uses a similar state pattern and merits a targeted test. | Clear the previous operation result when starting a new mutation or use one status object per operation. |
| D6 | M6-26, M6-F9 | V13 shows materially different assignment-list behavior: the reference has unassigned patient rows and Assign/Change assignment actions. The implementation lists persisted relationships only and offers deactivation and a separate creation form. | Confirm which table and actions are required, then align the mockup and implementation with the historical assignment workflow. |

### Missing implementation

| ID | Criteria | Gap | Suggested correction |
| --- | --- | --- | --- |
| D2 | G3-6, G3-10, G3-F3 | U21 verified that a new intake changes the dashboard. Creating a medication alone affects no dashboard data because the page loads intake history only. U5 found no direct management link. The two-step route via Record Medication works, and profile navigation works. The audit interprets dashboard navigation as a direct link. | Agree on the medication-only summary or indicator and add an explicit medication-management link if the direct interpretation is intended. |
| D4 | G5-19, G5-F7 | In U19 the browser focused the first invalid field. The red validation banner in reference 18 did not render for missing inputs, although native validation prevented submission. | Add the specified in-page feedback for invalid fields and preserve the native constraints and API validation. |
| D9 | G1-18, G1-F7 | Reference 02 has five fields and keeps the form visually compact. The implementation adds the three required patient details in a new group and the taller form extends below the initial 900px desktop viewport. Mobile horizontal fit passed in the existing visual test. | Update the registration reference to include all eight required fields and adjust the form layout to match the approved reference. |

### Implemented but untested

- G1-F5. Verify that duplicate public registration shows an error and stays on the form in Edge.
- G4-15, G4-18, G4-F3 and G4-F6. Verify the standalone management list's empty state, required-input feedback, and failed mutation feedback in the browser.
- M4-12 and M4-F4. Verify that the monitoring route displays its own empty-history UI while leaving the patient profile visible.
- **D7.** M6-14 and M6-B5 are **blocked**. The code locks the patient row first in the transaction and checks for an active duplicate before inserting. SQLite does not implement the InnoDB row-locking semantics, and no disposable MariaDB service was available. Run simultaneous requests using separate MariaDB connections and assert one creation, only conflicts for the rest, and exactly one active row. The schema has foreign keys and status/date checks, but no database-level conditional uniqueness constraint for active pairs. Sequential duplicates passed.

### Verified and passed

The criterion tables identify each pass and the supporting evidence. They include runtime coverage for role-based login and authorization, reset-token expiry and invalidation, profile ownership and persistence, medication/intake ownership, UTC normalization, chronological history, and the sequential assignment lifecycle. The test suites are broad, but passing tests do not override a failed criterion or an approved-design question.

### Requirements needing clarification

| ID | Question | Audit treatment |
| --- | --- | --- |
| Q1 | Which Figma screen governs the Administrator Dashboard? The available set includes Manage Users and Assignments, but has no Administrator Dashboard screen. | M5-30 and M5-F10 are Blocked for the combined design requirement. The dashboard data was verified separately. Manage Users adds email, two creation actions, an administrator row and omits patient Edit. |
| Q2 | Should phone, birth date and address be required on patient edits and phone/workplace on professional edits, as they are on account creation? | Reviewed edit-specific required fields as defined in the current forms and schema. Invalid provided phone reported independently under D1. |
| Q3 | Is there a separate My Medications reference? References 06 and 14 depict recording states. | Compared the standalone management page against the supplied visual conventions; exact standalone layout was not assessed. |
| Q4 | Should feature-driven differences be reflected in revised Figma references? | Compared shared layout and core behavior. Differences for 03/04, 07–12 and 14–16 are listed in the design review. Major observable gaps are classified separately. |
| Q5 | Should password reset conceal account existence as M2-8 requires, or show the Login & Password Reset diagram's email-not-found branch? | Used the numbered requirement. Generic production-style responses passed. The configured development link is the explicit exception in M2-24. |
| Q6 | Should history show the current medication name/dosage or a snapshot from the time of intake? | History joins the current medication values. G6 requires these fields and retention after deactivation, but does not specify snapshot semantics. |


## Activity diagram consistency

| Diagram in `docs/Activity Diagrams` | Comparison with implementation |
| --- | --- |
| Patient Registration | Enter details, validate, reject duplicate, persist linked records, confirm and return to Login. E1/B1/R21 cover the main path and atomic failure. Existing error banner replaces the diagram's specific duplicate wording with a conflict message that can also mention license/assignment. |
| Profile Management | Retrieve, display, edit, validate, persist and confirm are present. E1 verifies save and reload; U8 Cancel; U22–U23 failure paths. R5 finds a validation gap on provided phone. |
| Login Reset Password | Login validates credentials and routes by role. The diagram's Patient/Healthcare Professional branches are imprecisely labelled and omit Admin. M1 explicitly requires Admin, which E2 verifies. Reset uses a delivered link and validates its token when submitting the new password. The diagram suggests an email-not-found message and earlier validity gate. The numbered criteria require generic public feedback. See Q5. |
| Medication Intake Recording | Active owned medications, empty branch, date/time validation, save and confirmation match the flow. Medications are patient-managed, although the diagram calls them prescribed. The implemented no-medications action leads to medication management. E1, U10–U11 and R7 cover the branches. |
| Medication History | Fetches only the patient's saved records and displays populated or empty branch. R7 verifies order and isolation, F3 verifies the empty view, U24 verifies separate failure handling. |
| Healthcare Professional Patient Monitoring | List, empty, select, server-side authorization, denied view, and detail/history branches are present. B5/E2/R12–R14 verify assignment transitions. Monitoring-specific empty UI remains untested. R10 exposes the missing-resource difference. |

## Figma reference consistency

The 18 exported reference PNGs under `docs/UX - UI` were inspected visually. Authenticated runtime screenshots used synthetic data. Empty-state references 14–16 were compared against rendered component behavior and JSX, with the evidence scope identified below. This was a manual visual and interaction review, with 390px checks on registration, dashboard and history.

| Evidence | Reference | Comparison |
| --- | --- | --- |
| V01 | `01_Login.png` | Split blue hero, sign-in card, labels and links closely match. V, U1. |
| V02 | `02_Patient_Registration.png` | Shared auth design and actions, but the three added mandatory fields make the form taller and change its grouping. V/E1 and D9. |
| V03 | `03_Forgot_Password.png` | Email form, send control and back link align. Generic feedback appears conditionally after submission, above the controls, while the reference illustrates it beneath the controls. U2/B6. |
| V04 | `04_Reset_Password.png` | Same two password controls, primary action and return link. The initial info panel explains password policy instead of the validity/expiry note in the reference. U3/E1. |
| V05 | `05_Patient_Dashboard.png` | Same sidebar, summary cards, quick actions and recent activity. Greeting, status descriptions and notes reflect implementation. Direct management shortcut is absent, D2. E1/U7/U21. |
| V06 | `06_Record_Medication.png` | Medication, date, time, optional notes, Save and Cancel align. A management shortcut was added. Confirmation is in the form after save instead of a separate After saving card. E1/U21. |
| V07 | `07_Medication_History.png` | Same list/action structure and recorded status. Notes added for G6. Empty guidance appears when appropriate. U6/U7. |
| V08 | `08_Patient_Profile.png` | Same main route, title, save/cancel pattern and editable core fields. Patient detail fields add a separate group. Success appears after saving. E1/U8. |
| V09 | `09_Healthcare_Dashboard.png` | Three summary cards and patient detail access align. Shared list adds search, Account column and count badge. Uses Open profile instead of View details. U13. |
| V10 | `10_My_Patients.png` | Same search, assigned count and detail action. Adds per-patient Records count. U14. |
| V11 | `11_Patient_Monitoring.png` | Profile card and intake history align. Contact details, medications and notes added to satisfy M4. U15/E2. |
| V12 | `12_Admin_Manage_Users.png` | Table, tabs, search and status controls share the layout. Adds email, two role-specific creation buttons and Admin rows. Only professionals have Edit as specified by M5. U17 and Q1. |
| V13 | `13_Admin_Assignments.png` | Selection and save controls align. Historical relationships replace patient-centric rows, so unassigned patients do not have a row and there are no row-level Assign/Change actions. U18/U30 and D6. |
| V14 | `14_Empty_No_Medications.png` | Empty state and no usable intake form align. Direct medication creation/management links replace reference text pointing to a professional. F3/U10. |
| V15 | `15_Empty_Medication_History.png` | Centered empty state and recording action align. A second recording action remains in the card header. F3. |
| V16 | `16_Empty_No_Assigned_Patients.png` | Same explanatory empty state and administrative contact instruction. The icon is approximate. F3. |
| V17 | `17_Access_Denied.png` | Access notice explains assigned-patient scope and offers Back to my patients. E2. |
| V18 | `18_Form_Validation.png` | Native browser validation prevents empty intake submission, but the red in-page banner and composed message from the reference were absent. U19 and D4. |

## G1 — Patient Registration

Frontend: [AuthPages.jsx](../frontend/src/AuthPages.jsx), [PatientPages.jsx](../frontend/src/PatientPages.jsx), [components.jsx](../frontend/src/components.jsx). Backend: [routers/auth.py](../backend/app/routers/auth.py), [schemas/__init__.py](../backend/app/schemas/__init__.py), [services/accounts.py](../backend/app/services/accounts.py). Database: [schema.sql](../database/schema.sql), [models](../backend/app/models/__init__.py) and [initial migration](../backend/alembic/versions/0001_initial.py), especially USERS, PATIENT_PROFILES.

### User Story acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| G1-1 | Public registration page | Yes | Pass | Story source links above | V, E1, E2 sets up a patient through API | — |
| G1-2 | All eight required fields appear | Yes | Pass | Story source links above | E1 fills all eight, F1 covers role details | — |
| G1-3 | Any empty required field blocks creation and displays validation | Yes | Pass | Story source links above | F1, B2, E1 form plus native required attributes on all eight inputs | — |
| G1-4 | Reject malformed email | Yes | Pass | Story source links above | B1 rejects malformed registration email | — |
| G1-5 | Case-insensitive uniqueness | Yes | Pass | Story source links above | R1 uppercase duplicate returned 409 | — |
| G1-6 | Enforce 10–128 characters with a letter and digit | Yes | Pass | Story source links above | B1 short password, R1 upper bound and letter/digit policy | — |
| G1-7 | Confirmation must exactly match and show error | Yes | Pass | Story source links above | B1, F1 | — |
| G1-8 | Valid calendar date and no future date | Yes | Pass | Story source links above | B2, R1 | — |
| G1-9 | Phone accepts 7–15 digits with supported formatting and optional country code | Partial | Fail | Story source links above | R1 accepts one formatted international number, R20 rejects a 15-digit number with allowed formatting, D8 | Normalize supported formatted values or align input and storage lengths. |
| G1-10 | Reject whitespace-only first name, last name and address | Yes | Pass | Story source links above | B1 empty name, B2 whitespace address, R1 whitespace last name and address, same Name type for both names | — |
| G1-11 | Create one active patient account | Yes | Pass | Story source links above | B1, B2, E1 real login | — |
| G1-12 | Create linked profile with matching PatientID | Yes | Pass | Story source links above | B1, B2 check profile by user ID | — |
| G1-13 | Store Argon2 hash | Yes | Pass | Story source links above | B1 checks hash prefix | — |
| G1-14 | Failed registration leaves no orphan user | Yes | Pass | Story source links above | R21 forcibly aborts the profile insert and checks neither account survives, B1 | — |
| G1-15 | Show confirmation and redirect to login | Yes | Pass | Story source links above | E1 asserts confirmation and logs in from resulting page | — |
| G1-16 | Log in with registered credentials | Yes | Pass | Story source links above | E1, B3 | — |
| G1-17 | No professional or admin role through public registration | Yes | Pass | Story source links above | B1 rejects role override, patient workflow verifies role | — |
| G1-18 | Registration design and clear validation | Partial | Fail | Story source links above | V, E1, F1, D9 | Approve a reference with all eight fields and align form layout. |

### Backend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| G1-B1 | Valid POST creates both records | Yes | Pass | Backend and database above | B1, B2 | — |
| G1-B2 | Missing and malformed values, bad password lengths, phone and future birth dates rejected | Yes | Pass | Backend and database above | B1, B2, R1 | — |
| G1-B3 | Duplicate email HTTP 409 with no extra account | Yes | Pass | Backend and database above | B1 and R1, unique USERS.Email | — |
| G1-B4 | Use Argon2 hashing | Yes | Pass | Backend and database above | B1 | — |
| G1-B5 | Create user/profile in one transaction | Yes | Pass | Backend and database above | R21 forces profile insert failure and confirms the user insert rolls back | — |
| G1-B6 | Public route is patient-only even with unauthorized role input | Yes | Pass | Backend and database above | B1 and E1. API rejects the request containing the unauthorized field | — |

### Frontend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| G1-F1 | Display all eight fields | Yes | Pass | Frontend above and its API | E1, F1 | — |
| G1-F2 | Show validation for empty or invalid values | Yes | Pass | Frontend above and its API | F1 and V, native control feedback plus common validation notice | — |
| G1-F3 | Confirmation matches before valid request | Yes | Pass | Frontend above and its API | F1 | — |
| G1-F4 | Valid form calls API | Yes | Pass | Frontend above and its API | E1 | — |
| G1-F5 | Duplicate email shows error and keeps user on registration | Yes | Not Tested | Frontend above and its API | B1 covers API, no duplicate browser assertion | Add a targeted automated assertion for this branch. |
| G1-F6 | Success message and login redirect | Yes | Pass | Frontend above and its API | E1 | — |
| G1-F7 | Preserve registration design and small-screen usability | Partial | Fail | Frontend above and its API | V mobile width passes, D9 | Approve a reference with all eight fields and align form layout. |

## G2 — Patient and Professional Profile Management

Frontend: [App.jsx](../frontend/src/App.jsx), [PatientPages.jsx](../frontend/src/PatientPages.jsx), [components.jsx](../frontend/src/components.jsx). Backend: [routers/profiles.py](../backend/app/routers/profiles.py), [schemas/__init__.py](../backend/app/schemas/__init__.py), [services/accounts.py](../backend/app/services/accounts.py), [core/security.py](../backend/app/core/security.py). Database: [schema.sql](../database/schema.sql), [models](../backend/app/models/__init__.py) and [initial migration](../backend/alembic/versions/0001_initial.py), especially USERS, PATIENT_PROFILES, PROFESSIONAL_PROFILES.

### User Story acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| G2-1 | Own profile pages available only to authenticated patient/professional | Yes | Pass | Story source links above | U4, U8, U16 and F2 shared route guard | — |
| G2-2 | Patient My Profile loads saved database data | Yes | Pass | Story source links above | E1 reload checks persisted phone, R4 | — |
| G2-3 | Patient sees name, email, phone, birth date and address | Yes | Pass | Story source links above | E1 and U8 plus role-specific field inspection | — |
| G2-4 | Professional My Profile loads saved profile | Yes | Pass | Story source links above | R4 and U16 | — |
| G2-5 | Professional sees name, email, phone, specialization, license and workplace | Yes | Pass | Story source links above | U16 and role-specific field inspection | — |
| G2-6 | Only relevant role fields shown | Yes | Pass | Story source links above | U8, U16 | — |
| G2-7 | Edit and save supported fields | Yes | Pass | Story source links above | B3 verifies patient and professional saves, E1 confirms patient edit | — |
| G2-8 | Reject bad-format or duplicate email updates | Yes | Pass | Story source links above | R4 | — |
| G2-9 | Reject duplicate professional license updates | Yes | Pass | Story source links above | R4 | — |
| G2-10 | Reject invalid profile values including phone and future birth date | Partial | Fail | Story source links above | R4 future date rejected, R5 invalid phone accepted, D1 | Apply digit-count validation to provided edit phones. |
| G2-11 | Reject empty or whitespace-only required fields | Yes | Pass | Story source links above | Required fields share trimmed Name and EmailStr validators exercised by B1 and R1, browser uses native required. Role-detail fields marked optional are discussed in Q2 | Confirm optional edit fields. |
| G2-12 | Show successful update confirmation | Yes | Pass | Story source links above | E1 on patient, shared MyProfile submit for both roles | — |
| G2-13 | Retain saved changes on refresh or next login | Yes | Pass | Story source links above | E1 reload, B3 persisted API reads | — |
| G2-14 | Cancel or reload restores saved information | Yes | Pass | Story source links above | U8, E1 reload | — |
| G2-15 | Patient cannot read or update another patient profile through own routes | Yes | Pass | Story source links above | B3 rejects injected ID. Self endpoint uses authenticated ID, R4 owner read | — |
| G2-16 | Professional cannot update another professional via self endpoint | Yes | Pass | Story source links above | R4 rejects injected ID | — |
| G2-17 | Reject unauthenticated and wrong-role requests | Yes | Pass | Story source links above | B3, R4. Admin may retrieve its own identity at the generic GET endpoint | — |
| G2-18 | Show error when retrieval or saving fails | Yes | Pass | Story source links above | U22, U23 | — |

### Backend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| G2-B1 | GET me retrieves authenticated profile | Yes | Pass | Backend and database above | R4, B3 | — |
| G2-B2 | Patient PUT updates own profile | Yes | Pass | Backend and database above | B3, E1 | — |
| G2-B3 | Professional PUT updates own profile | Yes | Pass | Backend and database above | B3 | — |
| G2-B4 | Reject invalid formats and duplicate email/license | Partial | Fail | Backend and database above | R4 duplicates and malformed email covered, R5 invalid phone persisted, D1 | Apply digit-count validation to provided edit phones. |
| G2-B5 | Changes persist | Yes | Pass | Backend and database above | B3, E1 | — |
| G2-B6 | Deny unauthorized, wrong-role and other-user edits | Yes | Pass | Backend and database above | B3, R4 | — |

### Frontend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| G2-F1 | Display saved role-specific fields | Yes | Pass | Frontend above and its API | E1, U8, U16 | — |
| G2-F2 | Edit and save supported fields | Yes | Pass | Frontend above and its API | E1, B3 | — |
| G2-F3 | Show feedback on invalid values | Partial | Fail | Frontend above and its API | U23 confirms error rendering, invalid phone reaches save and is accepted, R5, D1 | Apply digit-count validation to provided edit phones. |
| G2-F4 | Show saved confirmation and survive reload | Yes | Pass | Frontend above and its API | E1 | — |
| G2-F5 | Cancel and reload restore saved data | Yes | Pass | Frontend above and its API | U8, E1 | — |
| G2-F6 | Use consistent navigation and UI styling | Yes | Pass | Frontend above and its API | U8, U16 and V08. Added role-specific fields are expected by G2 | — |

## G3 — Patient Dashboard

Frontend: [App.jsx](../frontend/src/App.jsx), [AuthPages.jsx](../frontend/src/AuthPages.jsx), [PatientPages.jsx](../frontend/src/PatientPages.jsx), [components.jsx](../frontend/src/components.jsx). Backend: [routers/auth.py](../backend/app/routers/auth.py), [routers/medications.py](../backend/app/routers/medications.py), [services/medications.py](../backend/app/services/medications.py). Database: [schema.sql](../database/schema.sql), [models](../backend/app/models/__init__.py) and [initial migration](../backend/alembic/versions/0001_initial.py), especially USERS, PATIENT_PROFILES, MEDICATIONS, MEDICATION_INTAKES.

### User Story acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| G3-1 | Successful patient login opens dashboard | Yes | Pass | Story source links above | E1 | — |
| G3-2 | Only authenticated patient role can open dashboard | Yes | Pass | Story source links above | F2 protected-route tests, U4 and V | — |
| G3-3 | Dashboard uses current patient's information | Yes | Pass | Story source links above | E1 real registration/login greeting, U21 | — |
| G3-4 | Display saved account/profile information | Yes | Pass | Story source links above | E1 verifies actual first name, R3 verifies account identity. Active status follows the active-session gate | — |
| G3-5 | Calculate summaries from the patient's saved records | Yes | Pass | Story source links above | R7 isolates history, U21 tests integration with new intake | — |
| G3-6 | Reflect both new medications and new intakes after refresh | Partial | Fail | Story source links above | U21 verifies intake, source only requests intake history so medication creation alone changes no dashboard information, D2 | Define the medication-only dashboard indicator and add a direct management link. |
| G3-7 | Handle zero records safely | Yes | Pass | Story source links above | E1 opens dashboard for a new patient, B4 empty response | — |
| G3-8 | Navigate to recording | Yes | Pass | Story source links above | U20 and shared link route, E1 navigates via sidebar | — |
| G3-9 | Navigate to history | Yes | Pass | Story source links above | U6 follows dashboard history link | — |
| G3-10 | Provide working routes to medication and profile management | Partial | Fail | Story source links above | U5 direct medication management absent and U8 profile navigation passes, D2 | Define the medication-only dashboard indicator and add a direct management link. |
| G3-11 | Patient cannot access other role dashboards | Yes | Pass | Story source links above | U4 | — |
| G3-12 | Display suitable fetch error/retry | Yes | Pass | Story source links above | U25 | — |
| G3-13 | Show loading feedback | Yes | Pass | Story source links above | U25 | — |
| G3-14 | Follow Figma 05 navigation, cards and layout | Yes | Pass | Story source links above | V05 consistent overall structure, different greeting and data-derived descriptions | — |
| G3-15 | Remain usable on small screens | Yes | Pass | Story source links above | U7 checks 390px width | — |

### Backend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| G3-B1 | Use authorized API endpoints | Yes | Pass | Backend and database above | R3, R6 and E1 | — |
| G3-B2 | Scope data to current patient | Yes | Pass | Backend and database above | R7, R3 | — |
| G3-B3 | Summaries reflect saved records | Yes | Pass | Backend and database above | R7, U21 | — |
| G3-B4 | Return safe empty history | Yes | Pass | Backend and database above | B4 | — |
| G3-B5 | No access to other patient's dashboard records | Yes | Pass | Backend and database above | B4 and R6–R7 | — |

### Frontend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| G3-F1 | Dashboard follows supplied layout | Yes | Pass | Frontend above and its API | V05 | — |
| G3-F2 | Patient info and summaries sourced from API | Yes | Pass | Frontend above and its API | E1, U21 | — |
| G3-F3 | Links open all intended patient destinations | Partial | Fail | Frontend above and its API | U5, U6, U8, D2 | Define the medication-only dashboard indicator and add a direct management link. |
| G3-F4 | Handle empty and failed requests | Yes | Pass | Frontend above and its API | E1, B4, U25 | — |
| G3-F5 | Responsive dashboard | Yes | Pass | Frontend above and its API | U7 | — |

## G4 — Patient Medication Management

Frontend: [App.jsx](../frontend/src/App.jsx), [PatientPages.jsx](../frontend/src/PatientPages.jsx), [components.jsx](../frontend/src/components.jsx). Backend: [routers/medications.py](../backend/app/routers/medications.py), [services/medications.py](../backend/app/services/medications.py), [schemas/__init__.py](../backend/app/schemas/__init__.py). Database: [schema.sql](../database/schema.sql), [models](../backend/app/models/__init__.py) and [initial migration](../backend/alembic/versions/0001_initial.py), especially MEDICATIONS, MEDICATION_INTAKES.

### User Story acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| G4-1 | Only authenticated patients can manage medications | Yes | Pass | Story source links above | R6 authorization and protected-route checks | — |
| G4-2 | List only signed-in patient's medications | Yes | Pass | Story source links above | R6 | — |
| G4-3 | Create medication | Yes | Pass | Story source links above | B4, E1 | — |
| G4-4 | Require name, dosage and frequency | Yes | Pass | Story source links above | R6; E1 supplies all three | — |
| G4-5 | Optional instructions | Yes | Pass | Story source links above | R6 supplies instructions, E1 omission succeeds | — |
| G4-6 | Reject missing, empty and whitespace-only required values | Yes | Pass | Story source links above | R6 exercises omission and whitespace; trimmed validators also reject empty | — |
| G4-7 | New medication appears after save | Yes | Pass | Story source links above | E1 | — |
| G4-8 | Edit name, dose, frequency and instructions | Yes | Pass | Story source links above | R8 API updates all fields, U9 edit saves despite missing notice | — |
| G4-9 | Deactivate owned medication | Yes | Pass | Story source links above | B4, R8, U10 | — |
| G4-10 | Reactivate previously deactivated medication | Yes | Pass | Story source links above | R8, U10–U11 | — |
| G4-11 | Inactive medication excluded from recording | Yes | Pass | Story source links above | B4, R8, U10 | — |
| G4-12 | Deactivation preserves previous records | Yes | Pass | Story source links above | B4, R8 | — |
| G4-13 | History remains accessible after deactivation | Yes | Pass | Story source links above | B4, R8 | — |
| G4-14 | No cross-patient medication reads or edits | Yes | Pass | Story source links above | R6, B4 | — |
| G4-15 | Show appropriate no-medications state | Yes | Not Tested | Story source links above | Management route has dedicated empty markup. F3 and U10 exercise the related Record Medication empty state only | Add a targeted automated assertion for this branch. |
| G4-16 | Empty state gives access to medication creation | Yes | Pass | Story source links above | U10. Management page places creation form above empty state | — |
| G4-17 | Show confirmation for create, edit, activate and deactivate | Partial | Fail | Story source links above | U9 edit notice disappears, U10 status changes, D3 | Store edit confirmation outside the remounted form. |
| G4-18 | Show errors without implying save after rejected medication operation | Yes | Not Tested | Story source links above | Shared Form and toggle catch errors. No forced medication save rejection in browser, D10 source risk | Clear old success state before starting a new mutation. |
| G4-19 | Follow existing medication UI design conventions | Yes | Pass | Story source links above | V06 and V14 cover related record states. No standalone management mockup, Q3 | Supply a dedicated management reference if exact layout is required. |

### Backend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| G4-B1 | GET returns own medications | Yes | Pass | Backend and database above | R6 | — |
| G4-B2 | POST saves valid medication | Yes | Pass | Backend and database above | E1, B4 | — |
| G4-B3 | PUT edits owned medication and supports status | Yes | Pass | Backend and database above | R8 | — |
| G4-B4 | Reject missing required information | Yes | Pass | Backend and database above | R6 | — |
| G4-B5 | Prevent access to another patient's medication | Yes | Pass | Backend and database above | B4, R6 | — |
| G4-B6 | Retain history on deactivation | Yes | Pass | Backend and database above | R8, B4 | — |
| G4-B7 | Restrict recording to active medication | Yes | Pass | Backend and database above | B4, R8 | — |

### Frontend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| G4-F1 | Display name, dosage, frequency and status | Yes | Pass | Frontend above and its API | E1 list and U10 status interaction, table fields inspected | — |
| G4-F2 | Add and edit forms accept required data | Yes | Pass | Frontend above and its API | E1, U9 | — |
| G4-F3 | Display error for missing required form values | Yes | Not Tested | Frontend above and its API | R6 backend, native required attributes reviewed but management form omission was not exercised in browser | Add a targeted automated assertion for this branch. |
| G4-F4 | Refresh list after saving | Yes | Pass | Frontend above and its API | E1, U9/U10 | — |
| G4-F5 | Activate/deactivate through API | Yes | Pass | Frontend above and its API | U10–U11, R8 | — |
| G4-F6 | Show suitable empty state | Yes | Not Tested | Frontend above and its API | Management-specific empty branch reviewed; F3/U10 cover only Record Medication | Add a targeted automated assertion for this branch. |
| G4-F7 | Consistent styling with related screens | Yes | Pass | Frontend above and its API | V06, V14, Q3 | Supply a dedicated management reference if exact layout is required. |

## G5 — Medication Intake Recording

Frontend: [App.jsx](../frontend/src/App.jsx), [PatientPages.jsx](../frontend/src/PatientPages.jsx), [components.jsx](../frontend/src/components.jsx). Backend: [routers/medications.py](../backend/app/routers/medications.py), [services/medications.py](../backend/app/services/medications.py), [schemas/__init__.py](../backend/app/schemas/__init__.py). Database: [schema.sql](../database/schema.sql), [models](../backend/app/models/__init__.py) and [initial migration](../backend/alembic/versions/0001_initial.py), especially MEDICATIONS, MEDICATION_INTAKES.

### User Story acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| G5-1 | Intake page restricted to authenticated patients | Yes | Pass | Story source links above | F2, R6, E1 route | — |
| G5-2 | Dropdown lists the patient's active medications | Yes | Pass | Story source links above | E1, R6, U10 | — |
| G5-3 | Inactive medications cannot be selected | Yes | Pass | Story source links above | B4, U10 | — |
| G5-4 | Require valid selection | Yes | Pass | Story source links above | U11 native validity, R7 validates API | — |
| G5-5 | Require date and time | Yes | Pass | Story source links above | U11, R7 | — |
| G5-6 | Notes optional | Yes | Pass | Story source links above | E1 and R7 | — |
| G5-7 | Missing medication blocks save and gives validation feedback | Yes | Pass | Story source links above | U11 native validity, R7; inline Figma banner separately fails G5-19 | — |
| G5-8 | Reject missing or invalid intake timestamp | Yes | Pass | Story source links above | U11, R7 | — |
| G5-9 | Reject future intake | Yes | Pass | Story source links above | B4, R7, U20 | — |
| G5-10 | Accept valid past intake | Yes | Pass | Story source links above | E1, R7 | — |
| G5-11 | Explicit timezone and normalized UTC | Yes | Pass | Story source links above | R7 with explicit offset and UTC reread; U6 local rendering | — |
| G5-12 | Reject invalid or nonexistent IDs without creating records | Yes | Pass | Story source links above | R7 | — |
| G5-13 | Reject another patient's medication ID | Yes | Pass | Story source links above | B4, R7 | — |
| G5-14 | No active medications state guides to management | Yes | Pass | Story source links above | F3, U10 | — |
| G5-15 | Create intake linked to selected medication | Yes | Pass | Story source links above | R7 observes correct persisted relationship, E1 | — |
| G5-16 | Show confirmation after successful save only | Yes | Pass | Story source links above | E1, U21 and submit awaits API before showing message | — |
| G5-17 | Show saved medication, timestamp and notes in history | Yes | Pass | Story source links above | R7, U6, E1 | — |
| G5-18 | Invalid submissions leave no partial or incorrect records | Yes | Pass | Story source links above | R7 compares complete history after invalid requests, U11 | — |
| G5-19 | Follow Record Medication and validation designs | Partial | Fail | Story source links above | V06, V14 and V18, U19, D4 | Add in-page invalid-input feedback while retaining save validation. |

### Backend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| G5-B1 | POST saves a valid intake | Yes | Pass | Backend and database above | B4, E1, R7 | — |
| G5-B2 | Require existing, active, owned medication | Yes | Pass | Backend and database above | B4, R7, R8 | — |
| G5-B3 | Reject missing, invalid and future timestamps | Yes | Pass | Backend and database above | R7 | — |
| G5-B4 | Accept explicit offset and normalize UTC | Yes | Pass | Backend and database above | R7 | — |
| G5-B5 | Allow optional notes | Yes | Pass | Backend and database above | E1, R7 | — |
| G5-B6 | Link correct medication ID | Yes | Pass | Backend and database above | R7 | — |
| G5-B7 | Invalid/unauthorized requests create no records | Yes | Pass | Backend and database above | B4, R7 | — |

### Frontend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| G5-F1 | Dropdown displays only active own medication | Yes | Pass | Frontend above and its API | E1, R6, U10 | — |
| G5-F2 | Medication and date/time required | Yes | Pass | Frontend above and its API | U11 | — |
| G5-F3 | Display invalid or future date feedback | Yes | Pass | Frontend above and its API | U11, U20 native constraint checks | — |
| G5-F4 | Submit valid values to API | Yes | Pass | Frontend above and its API | E1, U21 | — |
| G5-F5 | Show save confirmation | Yes | Pass | Frontend above and its API | E1, U21 | — |
| G5-F6 | Show no-medications screen | Yes | Pass | Frontend above and its API | F3, U10 | — |
| G5-F7 | Follow referenced UI design | Partial | Fail | Frontend above and its API | V06/V14/V18, D4 | Add in-page invalid-input feedback while retaining save validation. |

## G6 — Medication History Tracking

Frontend: [App.jsx](../frontend/src/App.jsx), [PatientPages.jsx](../frontend/src/PatientPages.jsx), [components.jsx](../frontend/src/components.jsx). Backend: [routers/medications.py](../backend/app/routers/medications.py), [services/medications.py](../backend/app/services/medications.py), [core/security.py](../backend/app/core/security.py). Database: [schema.sql](../database/schema.sql), [models](../backend/app/models/__init__.py) and [initial migration](../backend/alembic/versions/0001_initial.py), especially MEDICATIONS, MEDICATION_INTAKES.

### User Story acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| G6-1 | Only authenticated patients can access history | Yes | Pass | Story source links above | V, F2, R6 | — |
| G6-2 | Retrieve logged-in patient's entries | Yes | Pass | Story source links above | R7, B4 | — |
| G6-3 | Identify related medication for each row | Yes | Pass | Story source links above | E1, U6 | — |
| G6-4 | Show medication name and dosage | Yes | Pass | Story source links above | E1, U6 | — |
| G6-5 | Show recorded date and time | Yes | Pass | Story source links above | U6, R7 | — |
| G6-6 | Display provided notes | Yes | Pass | Story source links above | U6, U21, R7 | — |
| G6-7 | Show Recorded status | Yes | Pass | Story source links above | U6 | — |
| G6-8 | Sort newest TakenAt first | Yes | Pass | Story source links above | R7, U6 | — |
| G6-9 | Display UTC timestamps in browser local timezone | Yes | Pass | Story source links above | U6 runs with Asia/Beirut | — |
| G6-10 | Newly recorded intake appears after refresh/navigation | Yes | Pass | Story source links above | E1, U21 | — |
| G6-11 | Keep intakes visible after medication deactivation | Yes | Pass | Story source links above | B4, R8 | — |
| G6-12 | Show designed empty history state | Yes | Pass | Story source links above | F3 and V15 | — |
| G6-13 | Prevent cross-patient history access via API | Yes | Pass | Story source links above | B4, R7 | — |
| G6-14 | Reject unauthenticated API request | Yes | Pass | Story source links above | R6 | — |
| G6-15 | Show history loading feedback | Yes | Pass | Story source links above | U24 | — |
| G6-16 | Show error or retry on failure, not empty history | Yes | Pass | Story source links above | U24 | — |
| G6-17 | Preserve Figma layout and mobile usability | Yes | Pass | Story source links above | V07 and V15, U7. Notes column fulfills G6-6 | — |

### Backend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| G6-B1 | GET history returns only current patient's entries | Yes | Pass | Backend and database above | B4, R7 | — |
| G6-B2 | Include related intake and medication data | Yes | Pass | Backend and database above | B4, R7 | — |
| G6-B3 | Return newest first | Yes | Pass | Backend and database above | R7 | — |
| G6-B4 | Empty history returns successful empty list | Yes | Pass | Backend and database above | B4 | — |
| G6-B5 | History retained after deactivation | Yes | Pass | Backend and database above | B4, R8 | — |
| G6-B6 | Unauthenticated and unauthorized requests denied | Yes | Pass | Backend and database above | R6 | — |

### Frontend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| G6-F1 | Display stored entries | Yes | Pass | Frontend above and its API | E1, U6 | — |
| G6-F2 | Show newest first | Yes | Pass | Frontend above and its API | R7, U6 | — |
| G6-F3 | Use browser's local timezone | Yes | Pass | Frontend above and its API | U6 | — |
| G6-F4 | Show empty history message | Yes | Pass | Frontend above and its API | F3 | — |
| G6-F5 | Loading and errors handled | Yes | Pass | Frontend above and its API | U24 | — |
| G6-F6 | Follow design and remain responsive | Yes | Pass | Frontend above and its API | V07/V15, U7 | — |

## M1 — User Login and Authentication

Frontend: [App.jsx](../frontend/src/App.jsx), [AuthPages.jsx](../frontend/src/AuthPages.jsx), [api.js](../frontend/src/api.js), [components.jsx](../frontend/src/components.jsx). Backend: [routers/auth.py](../backend/app/routers/auth.py), [core/security.py](../backend/app/core/security.py), [schemas/__init__.py](../backend/app/schemas/__init__.py), [main.py](../backend/app/main.py). Database: [schema.sql](../database/schema.sql), [models](../backend/app/models/__init__.py) and [initial migration](../backend/alembic/versions/0001_initial.py), especially USERS and role profiles.

### User Story acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| M1-1 | The Login page must be accessible to users who are not authenticated. | Yes | Pass | Story source links above | F2, V | — |
| M1-2 | The login form must contain Email and Password fields. | Yes | Pass | Story source links above | E1, E2 and U1 use both fields | — |
| M1-3 | Email and Password must both be required. An empty field must prevent a valid login submission. | Yes | Pass | Story source links above | U1 and R2 | — |
| M1-4 | The system must accept valid credentials for an existing active patient, professional, or administrator account. | Yes | Pass | Story source links above | E1 patient, E2 admin/professional, R2–R3 | — |
| M1-5 | An incorrectly formatted email must be rejected through input validation. | Yes | Pass | Story source links above | U1 and R2 | — |
| M1-6 | A registered email combined with an incorrect password must be rejected and display an authentication error. | Yes | Pass | Story source links above | B3 wrong-password rejection, F2 error display | — |
| M1-7 | An email address that does not belong to a registered account must not allow login. | Yes | Pass | Story source links above | R2 unregistered credentials return 401 | — |
| M1-8 | The login process must verify passwords against the securely stored Argon2 hashes. | Yes | Pass | Story source links above | B1 Argon2 prefix, B3 and B7 authenticate and reject bad passwords through shared Argon2 verifier | — |
| M1-9 | An account with Status = `inactive` must be prevented from logging in. | Yes | Pass | Story source links above | B3 inactive patient, R9 inactive professional | — |
| M1-10 | After successful login, the system must issue a valid JWT authentication token. | Yes | Pass | Story source links above | B3 fixtures and R3 authenticate protected requests with issued JWTs | — |
| M1-11 | The JWT must have a 30-minute expiration and must be rejected after expiry. | Yes | Pass | Story source links above | R2 checks 1,800-second issued lifetime, B7 rejects expired token | — |
| M1-12 | Successful patient login must redirect to the Patient Dashboard. | Yes | Pass | Story source links above | E1 and U4 direct patient route | — |
| M1-13 | Successful professional login must redirect to the Healthcare Professional Dashboard. | Yes | Pass | Story source links above | U13 explicit professional route, E2 | — |
| M1-14 | Successful administrator login must redirect to the Administrator Dashboard. | Yes | Pass | Story source links above | U17 setup explicit admin route, E2 | — |
| M1-15 | The application must prevent unauthenticated users from opening protected pages and must direct them to login as appropriate. | Yes | Pass | Story source links above | V, F2 and U12 | — |
| M1-16 | A patient must not access administrator or professional-only functionality. | Yes | Pass | Story source links above | F2, U4, R3 | — |
| M1-17 | A professional must not access administrator-only functionality. | Yes | Pass | Story source links above | R3 denies all admin endpoints to professionals. Frontend shares Protected guard | — |
| M1-18 | Requests made without a valid JWT or with an invalid/expired JWT must be rejected by protected API endpoints. | Yes | Pass | Story source links above | B3 missing JWT, B7 invalid and expired, R3 matrix | — |
| M1-19 | Clicking Logout must remove the current session token from the browser and return the user to the unauthenticated interface. | Yes | Pass | Story source links above | U12 storage removal and redirect | — |
| M1-20 | After logout, the user must not be able to access protected pages using the cleared browser session without logging in again. | Yes | Pass | Story source links above | U12 direct protected route after logout | — |
| M1-21 | The Login page must follow the provided Figma design and display understandable errors without revealing sensitive authentication details. | Yes | Pass | Story source links above | V01 comparison, F2 generic error for incorrect credentials and B3 shares message for incorrect email/password | — |

### Backend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| M1-B1 | `POST /api/auth/login` authenticates valid active users. | Yes | Pass | Backend and database above | E1, E2, R2 | — |
| M1-B2 | Incorrect credentials return an authentication error without creating a valid session. | Yes | Pass | Backend and database above | B3, R2 and F2 | — |
| M1-B3 | Inactive accounts are rejected. | Yes | Pass | Backend and database above | B3, R9 | — |
| M1-B4 | Valid JWTs include the required identity and authorization information and expire after 30 minutes. | Yes | Pass | Backend and database above | B7, R2–R3. Authorization role is loaded from current database user using JWT subject | — |
| M1-B5 | Protected endpoints reject missing, invalid, or expired tokens. | Yes | Pass | Backend and database above | R3, B7 | — |
| M1-B6 | `GET /api/auth/me` returns the authenticated user's information. | Yes | Pass | Backend and database above | R3, U4 refresh | — |
| M1-B7 | Backend authorization prevents access by users with incorrect roles. | Yes | Pass | Backend and database above | R3, B3 | — |

### Frontend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| M1-F1 | Login form matches the Figma design. | Yes | Pass | Frontend above and its API | V01 | — |
| M1-F2 | Required inputs are validated. | Yes | Pass | Frontend above and its API | U1 | — |
| M1-F3 | Incorrect credentials display a clear error. | Yes | Pass | Frontend above and its API | F2, B3 | — |
| M1-F4 | Successful login redirects to the dashboard associated with the user's role. | Yes | Pass | Frontend above and its API | E1, E2, U4, U13 and U17 | — |
| M1-F5 | Protected routes reject unauthenticated access. | Yes | Pass | Frontend above and its API | V, F2 | — |
| M1-F6 | Logout clears the current session and redirects to login. | Yes | Pass | Frontend above and its API | U12 | — |
| M1-F7 | Refreshing a page with a valid session preserves appropriate authenticated access. | Yes | Pass | Frontend above and its API | E1 renews profile view on reload, U4 checks dashboard session | — |

## M2 — Forgot Password and Password Reset

Frontend: [App.jsx](../frontend/src/App.jsx), [AuthPages.jsx](../frontend/src/AuthPages.jsx), [components.jsx](../frontend/src/components.jsx), [api.js](../frontend/src/api.js). Backend: [routers/auth.py](../backend/app/routers/auth.py), [core/security.py](../backend/app/core/security.py), [core/config.py](../backend/app/core/config.py), [schemas/__init__.py](../backend/app/schemas/__init__.py), [services/mail.py](../backend/app/services/mail.py), [main.py](../backend/app/main.py). Database: [schema.sql](../database/schema.sql), [models](../backend/app/models/__init__.py) and [initial migration](../backend/alembic/versions/0001_initial.py), especially USERS, PASSWORD_RESET_TOKENS.

### User Story acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| M2-1 | The Login page must provide a way to navigate to Forgot Password. | Yes | Pass | Story source links above | U2 | — |
| M2-2 | The Forgot Password page must contain an Email field. | Yes | Pass | Story source links above | V, U2 | — |
| M2-3 | The submitted email must have a valid format. | Yes | Pass | Story source links above | U2 verifies native format validation, schema uses EmailStr | — |
| M2-4 | Submitting an empty or invalid email must display validation feedback. | Yes | Pass | Story source links above | U2 | — |
| M2-5 | A password-reset request for an existing account must generate a cryptographically secure reset token. | Yes | Pass | Story source links above | B6 and R16 exercise issuance and distinct tokens, code uses secrets.token_urlsafe(48) | — |
| M2-6 | The system must store only a hash of the reset token in PASSWORD_RESET_TOKENS. | Yes | Pass | Story source links above | B6, R16 | — |
| M2-7 | A reset token must expire 30 minutes after its creation. | Yes | Pass | Story source links above | R16 checks persisted lifetime, B6 checks expired rejection | — |
| M2-8 | The public forgot-password response must not reveal whether an email address is registered. | Yes | Pass | Story source links above | B6 public responses match with local link disabled. M2-24 permits configured development link | — |
| M2-9 | The Reset Password page must accept a valid reset link/token. | Yes | Pass | Story source links above | E1 follows actual reset link | — |
| M2-10 | The Reset Password page must contain New Password and Confirm Password fields. | Yes | Pass | Story source links above | V, U3, E1 | — |
| M2-11 | The new password must contain 10–128 characters, including at least one letter and one digit. | Yes | Pass | Story source links above | R17 covers empty, character classes and upper bound, B1 exercises shared short-password validator | — |
| M2-12 | Password confirmation must exactly match the new password. | Yes | Pass | Story source links above | F1 shared confirmation check, R17 reset mismatch rejected | — |
| M2-13 | Empty, mismatched, or policy-invalid passwords must be rejected. | Yes | Pass | Story source links above | R17, common browser constraints and E1 | — |
| M2-14 | A valid unused reset token must allow the account password to be updated. | Yes | Pass | Story source links above | B6, E1, R18 | — |
| M2-15 | An invalid or modified reset token must not allow the password to be changed. | Yes | Pass | Story source links above | R17 and U3 | — |
| M2-16 | An expired reset token must not allow the password to be changed. | Yes | Pass | Story source links above | B6 expired mode | — |
| M2-17 | A reset token that has already been used must not allow another reset. | Yes | Pass | Story source links above | B6 and R18 | — |
| M2-18 | After successful reset, the token must become unusable and previously issued unused reset tokens for that user must be invalidated. | Yes | Pass | Story source links above | R17 latest request invalidates earlier link, R19 checks no unused tokens after reset | — |
| M2-19 | The system must store the new password securely using Argon2 hashing. | Yes | Pass | Story source links above | R19 checks replacement Argon2 prefix | — |
| M2-20 | The old password must no longer authenticate after the reset. | Yes | Pass | Story source links above | R18 | — |
| M2-21 | The user must be able to log in with the new password after a successful reset. | Yes | Pass | Story source links above | R18, B6, E1 | — |
| M2-22 | Existing JWTs issued before the password change must be invalidated according to the implemented password-change session protection. | Yes | Pass | Story source links above | B6 verifies pre-change JWT denied after reset | — |
| M2-23 | The application must display a success message after password reset and appropriate errors for invalid or expired tokens. | Yes | Pass | Story source links above | E1 navigates back through successful reset, U3 explicitly checks invalid UI, B6 expired API uses same error | — |
| M2-24 | In development mode, a local development reset link may be provided when configured; production mode must not expose such a link. | Yes | Pass | Story source links above | E1 configured dev path, B7 invalid production configuration rejected | — |
| M2-25 | The Forgot Password and Reset Password pages must follow their corresponding Figma designs. | Yes | Pass | Story source links above | V03 and V04. Feedback placement and policy text differ, Q4 | Approve or update the reference for feature-driven differences. |

### Backend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| M2-B1 | `POST /api/auth/forgot-password` processes valid reset requests. | Yes | Pass | Backend and database above | B6, R16, E1 | — |
| M2-B2 | Public responses do not disclose whether an email is registered. | Yes | Pass | Backend and database above | B6 with local link disabled | — |
| M2-B3 | Reset-token hashes are stored without exposing plaintext tokens in the database. | Yes | Pass | Backend and database above | B6, R16 | — |
| M2-B4 | Reset tokens expire after 30 minutes and can be used only once. | Yes | Pass | Backend and database above | B6, R16–R18 | — |
| M2-B5 | `POST /api/auth/reset-password` rejects missing, expired, reused, or invalid tokens. | Yes | Pass | Backend and database above | B6, R17, R18 | — |
| M2-B6 | The new password follows the password policy and is securely hashed. | Yes | Pass | Backend and database above | R17 and R19 | — |
| M2-B7 | Previously issued sessions are invalidated by the password change. | Yes | Pass | Backend and database above | B6 | — |
| M2-B8 | Development reset-link behavior is separated from production configuration. | Yes | Pass | Backend and database above | B7 and E1. Live production SMTP is outside this evidence | — |

### Frontend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| M2-F1 | Forgot Password is accessible from Login. | Yes | Pass | Frontend above and its API | U2 | — |
| M2-F2 | Email input is validated before a valid request. | Yes | Pass | Frontend above and its API | U2 | — |
| M2-F3 | Reset Password validates the new password and confirmation. | Yes | Pass | Frontend above and its API | U3 plus R17 and F1 shared confirmation handling | — |
| M2-F4 | Valid reset links allow users to complete the reset workflow. | Yes | Pass | Frontend above and its API | E1 | — |
| M2-F5 | Invalid or expired links display an understandable error. | Yes | Pass | Frontend above and its API | U3, B6 | — |
| M2-F6 | Successful reset displays confirmation and allows navigation to login. | Yes | Pass | Frontend above and its API | E1 returns to login, AuthPages supplies confirmation via route state | — |
| M2-F7 | Both pages preserve the supplied UI design. | Yes | Pass | Frontend above and its API | V03, V04, Q4 | Approve or update the reference for feature-driven differences. |

## M3 — Healthcare Professional Dashboard and Assigned Patients

Frontend: [App.jsx](../frontend/src/App.jsx), [AuthPages.jsx](../frontend/src/AuthPages.jsx), [ProfessionalPages.jsx](../frontend/src/ProfessionalPages.jsx), [components.jsx](../frontend/src/components.jsx). Backend: [routers/monitoring.py](../backend/app/routers/monitoring.py), [services/accounts.py](../backend/app/services/accounts.py), [services/medications.py](../backend/app/services/medications.py), [core/security.py](../backend/app/core/security.py). Database: [schema.sql](../database/schema.sql), [models](../backend/app/models/__init__.py) and [initial migration](../backend/alembic/versions/0001_initial.py), especially PATIENT_PROFESSIONALS, USERS, PATIENT_PROFILES, MEDICATIONS, MEDICATION_INTAKES.

### User Story acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| M3-1 | After successful login, a user with the `professional` role must be redirected to the Healthcare Professional Dashboard. | Yes | Pass | Story source links above | U13, E2 | — |
| M3-2 | Only authenticated healthcare professionals may access professional dashboard functions. | Yes | Pass | Story source links above | R3 API role matrix and U4 frontend | — |
| M3-3 | The professional dashboard must display information relevant to the currently authenticated professional. | Yes | Pass | Story source links above | U13 and R12 confirm role-specific populated data | — |
| M3-4 | The dashboard must display the total number of patients actively assigned to the professional. | Yes | Pass | Story source links above | R12 assigned list count, U13 dashboard cards | — |
| M3-5 | The dashboard must display medication intake-record summaries based on the assigned patients' saved records. | Yes | Pass | Story source links above | R12 record counts, U13 | — |
| M3-6 | The displayed counts must come from the database, not hardcoded Figma sample values. | Yes | Pass | Story source links above | R12 exercises stored rows, U13 | — |
| M3-7 | The My Patients page must list patients who have an active assignment to the logged-in professional. | Yes | Pass | Story source links above | R12 and E2 | — |
| M3-8 | Patients with no active assignment to the professional must not appear in the assigned-patient list. | Yes | Pass | Story source links above | B5 checks empty before assignment, R13 checks exclusion after removal | — |
| M3-9 | Inactive patient accounts must not appear as actively accessible monitoring patients. | Yes | Pass | Story source links above | R14 | — |
| M3-10 | Each listed patient must display identifying information such as name and the supported medication-record summaries. | Yes | Pass | Story source links above | R12, U14–U15 and V10 show name, last intake and count | — |
| M3-11 | The page must provide a search field for filtering the professional's assigned patients by name. | Yes | Pass | Story source links above | U14 | — |
| M3-12 | Searching for a name that matches an assigned patient must display the matching result. | Yes | Pass | Story source links above | U14 | — |
| M3-13 | Searching for a name that does not match any assigned patient must display an appropriate no-results state. | Yes | Pass | Story source links above | U14 | — |
| M3-14 | Selecting an assigned patient must navigate to the corresponding Patient Monitoring page. | Yes | Pass | Story source links above | E2 and U15 | — |
| M3-15 | If the professional has no assigned patients, the system must display the specified No Assigned Patients empty state. | Yes | Pass | Story source links above | F3 and V16 | — |
| M3-16 | When an administrator creates a valid active assignment, the patient must appear in the corresponding professional's list after data is refreshed. | Yes | Pass | Story source links above | B5, E2 and R12 | — |
| M3-17 | When an assignment is deactivated, that patient must no longer appear as actively assigned unless another qualifying assignment remains. | Yes | Pass | Story source links above | R13 tests that another assignment to a different professional does not preserve access | — |
| M3-18 | Patients and administrators must not be allowed to use healthcare professional-only APIs by bypassing the frontend. | Yes | Pass | Story source links above | R3 | — |
| M3-19 | The interface must handle API failures with appropriate error feedback. | Yes | Pass | Story source links above | U26 | — |
| M3-20 | Healthcare Dashboard and My Patients must follow the supplied Figma designs. | Yes | Pass | Story source links above | V09 and V10. Shared table places Account/Records columns on both views and uses Open profile on dashboard, Q4 | Approve or update the reference for feature-driven differences. |

### Backend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| M3-B1 | `GET /api/monitoring/patients` returns patients assigned to the authenticated professional. | Yes | Pass | Backend and database above | B5, R12 | — |
| M3-B2 | Only active assignments to active patients are included in active monitoring lists. | Yes | Pass | Backend and database above | R13–R14 | — |
| M3-B3 | Dashboard counts correspond to the stored assigned-patient and medication information. | Yes | Pass | Backend and database above | R12 returns counts from stored records, aggregation is in frontend | — |
| M3-B4 | Unassigned patients are excluded. | Yes | Pass | Backend and database above | B5, R13 | — |
| M3-B5 | The endpoint returns an appropriate empty result when no patients are assigned. | Yes | Pass | Backend and database above | B5 | — |
| M3-B6 | Non-professional and unauthenticated requests are denied. | Yes | Pass | Backend and database above | R3 | — |

### Frontend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| M3-F1 | Dashboard counts and patient details come from API responses. | Yes | Pass | Frontend above and its API | R12, U13 | — |
| M3-F2 | The patient list displays only authorized assigned patients. | Yes | Pass | Frontend above and its API | B5, R12, E2 | — |
| M3-F3 | Name search filters the displayed list. | Yes | Pass | Frontend above and its API | U14 | — |
| M3-F4 | Selecting a patient opens the monitoring page. | Yes | Pass | Frontend above and its API | E2, U15 | — |
| M3-F5 | No Assigned Patients state appears when appropriate. | Yes | Pass | Frontend above and its API | F3, V16 | — |
| M3-F6 | Loading and errors are handled. | Yes | Pass | Frontend above and its API | U26 | — |
| M3-F7 | Both pages follow the supplied Figma designs. | Yes | Pass | Frontend above and its API | V09, V10, Q4 | Approve or update the reference for feature-driven differences. |

## M4 — Healthcare Professional Patient Monitoring

Frontend: [App.jsx](../frontend/src/App.jsx), [ProfessionalPages.jsx](../frontend/src/ProfessionalPages.jsx), [components.jsx](../frontend/src/components.jsx). Backend: [routers/monitoring.py](../backend/app/routers/monitoring.py), [services/medications.py](../backend/app/services/medications.py), [services/accounts.py](../backend/app/services/accounts.py), [core/security.py](../backend/app/core/security.py). Database: [schema.sql](../database/schema.sql), [models](../backend/app/models/__init__.py) and [initial migration](../backend/alembic/versions/0001_initial.py), especially PATIENT_PROFESSIONALS, USERS, PATIENT_PROFILES, MEDICATIONS, MEDICATION_INTAKES.

### User Story acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| M4-1 | An authenticated healthcare professional must be able to select a patient from their My Patients list. | Yes | Pass | Story source links above | E2, U14–U15 | — |
| M4-2 | Before patient information is returned, the backend must confirm that the professional has an active assignment to that patient. | Yes | Pass | Story source links above | B5 and R11–R13 | — |
| M4-3 | The patient account must be active for normal patient-monitoring access. | Yes | Pass | Story source links above | B7, R14 | — |
| M4-4 | For an authorized patient, the monitoring page must display the patient's saved profile information. | Yes | Pass | Story source links above | R12, E2, U15 | — |
| M4-5 | The patient profile must show the supported identifying/contact information available in PATIENT_PROFILES. | Yes | Pass | Story source links above | U15 verifies birth-date field, source renders name, email, phone, birth date and address from API | — |
| M4-6 | The page must display the patient's medications from the database. | Yes | Pass | Story source links above | R12 verifies selected medication, U15 and E2 display | — |
| M4-7 | Medication information must include the supported medication name, dosage, frequency, and status/details where available in the interface. | Yes | Pass | Story source links above | U15, R12. Medication table includes fields and status | — |
| M4-8 | The page must display the patient's recorded medication intake history. | Yes | Pass | Story source links above | E2, R12 | — |
| M4-9 | Intake history must show the related medication and recorded intake date/time. | Yes | Pass | Story source links above | E2, R7, R12 and shared HistoryTable exercised by U6 | — |
| M4-10 | Optional intake notes must be displayed where available. | Yes | Pass | Story source links above | U15 and R12 | — |
| M4-11 | The displayed records must belong to the selected patient, not another patient. | Yes | Pass | Story source links above | R12 uses multiple patients with distinct medication IDs and asserts selected history | — |
| M4-12 | If the patient has no medication intake records, the interface must show an appropriate empty state. | Yes | Not Tested | Story source links above | B5 verifies API empty history, frontend empty branch uses HistoryTable tested for patient history. No monitoring-specific empty UI assertion | Add a targeted automated assertion for this branch. |
| M4-13 | If the patient does not exist, the API must return an appropriate missing-resource response without exposing unrelated patient data. | Partial | Fail | Story source links above | R10 nonexistent patient returns 403, E2 expects Access Denied, D5 | Agree on 404 versus generic denial, then align API, UI and tests. |
| M4-14 | A professional must not be able to view an unassigned patient's information by changing the patient ID in the URL. | Yes | Pass | Story source links above | B5 denies actual unassigned ID, E2 verifies direct navigation denied, R13 | — |
| M4-15 | A professional must not be able to retrieve an unassigned patient's intake history by directly calling the API. | Yes | Pass | Story source links above | R11, R13 | — |
| M4-16 | Unauthorized access must produce an access-denied response, and the frontend must display the corresponding Access Denied state. | Yes | Pass | Story source links above | E2 verifies Access Denied, B5 and R13 enforce denial | — |
| M4-17 | After an administrator deactivates an assignment, the professional must no longer be authorized to monitor that patient through the deactivated relationship. | Yes | Pass | Story source links above | B5, R13 | — |
| M4-18 | An unauthenticated user or a user with an incorrect role must not be able to access professional monitoring endpoints. | Yes | Pass | Story source links above | R3 covers list, detail and history routes | — |
| M4-19 | The monitoring page must handle loading and API errors. | Yes | Pass | Story source links above | U27 | — |
| M4-20 | The interface must follow the provided Patient Monitoring and Access Denied Figma designs. | Yes | Pass | Story source links above | V11, V17. Added medication and contact information required by this story, Q4 | Approve or update the reference for feature-driven differences. |
| M4-21 | Monitoring must be limited to patient profiles and medication records; no fictional sensor measurements, rehabilitation results, or AI analysis must be displayed. | Yes | Pass | Story source links above | E2, U15 and implementation review limit displayed sections to profile/medications/intakes | — |

### Backend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| M4-B1 | `GET /api/monitoring/patients/{patient_id}` returns an authorized assigned patient's profile and supported medication information. | Yes | Pass | Backend and database above | R12, E2 | — |
| M4-B2 | `GET /api/monitoring/patients/{patient_id}/history` returns that patient's intake history. | Yes | Pass | Backend and database above | B5, R12 | — |
| M4-B3 | Every patient-specific request checks professional authorization and an active assignment. | Yes | Pass | Backend and database above | R3 and R11–R14 | — |
| M4-B4 | Unassigned patients are denied access, including through direct API requests. | Yes | Pass | Backend and database above | B5, R11 | — |
| M4-B5 | Inactive patients are not available for normal monitoring. | Yes | Pass | Backend and database above | B7, R14 | — |
| M4-B6 | Missing patients are handled without leaking unrelated patient information. | Yes | Pass | Backend and database above | E2, R10 shows generic denial with no unrelated information. Parent M4-13 separately requires missing-resource semantics | — |
| M4-B7 | Empty medication history is returned and handled correctly. | Yes | Pass | Backend and database above | B5 returns empty array, shared HistoryTable branch covered by F3 | — |

### Frontend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| M4-F1 | The page loads data for the selected assigned patient. | Yes | Pass | Frontend above and its API | E2, U15 | — |
| M4-F2 | Patient profile and medication records display correctly. | Yes | Pass | Frontend above and its API | E2, R12, U15 | — |
| M4-F3 | Intake history shows the saved records. | Yes | Pass | Frontend above and its API | E2, U15 | — |
| M4-F4 | No-record and loading states are handled. | Yes | Not Tested | Frontend above and its API | U27 checks loading, B5 empty API and source branch only for this route | Add a targeted automated assertion for this branch. |
| M4-F5 | Unauthorized access displays the Access Denied interface. | Yes | Pass | Frontend above and its API | E2, V17 | — |
| M4-F6 | The page follows the supplied design without including excluded advanced clinical features. | Yes | Pass | Frontend above and its API | V11, V17, E2 and U15 | — |

## M5 — Administrator Dashboard and User Management

Frontend: [App.jsx](../frontend/src/App.jsx), [AdminPages.jsx](../frontend/src/AdminPages.jsx), [PatientPages.jsx](../frontend/src/PatientPages.jsx), [components.jsx](../frontend/src/components.jsx). Backend: [routers/admin.py](../backend/app/routers/admin.py), [services/accounts.py](../backend/app/services/accounts.py), [core/security.py](../backend/app/core/security.py), [schemas/__init__.py](../backend/app/schemas/__init__.py). Database: [schema.sql](../database/schema.sql), [models](../backend/app/models/__init__.py) and [initial migration](../backend/alembic/versions/0001_initial.py), especially USERS, PATIENT_PROFILES, PROFESSIONAL_PROFILES, PATIENT_PROFESSIONALS.

### User Story acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| M5-1 | Only authenticated users with Role = `admin` must be able to access administrator management features. | Yes | Pass | Story source links above | R3, F2, U4 | — |
| M5-2 | The Administrator Dashboard must display database-based counts for users, patients, professionals, and active assignments. | Yes | Pass | Story source links above | U28 compares all four counts with saved data | — |
| M5-3 | The Manage Users page must display the saved user accounts with their roles and account statuses. | Yes | Pass | Story source links above | U17 and V12 confirm list, role and status columns | — |
| M5-4 | The All Users filter must display the supported patient and healthcare professional accounts. | Yes | Pass | Story source links above | F1 and U17 default All Users presents both operations, V12 populated table | — |
| M5-5 | The Patients filter must display patient accounts. | Yes | Pass | Story source links above | U17, F1 | — |
| M5-6 | The Healthcare Professionals filter must display professional accounts. | Yes | Pass | Story source links above | U17 | — |
| M5-7 | User search must allow administrators to locate accounts by supported name/email information. | Yes | Pass | Story source links above | U17 enters a name fragment also present in email, code searches concatenated full name/email | — |
| M5-8 | When the Patients filter is selected, the interface must provide the Add Patient action. | Yes | Pass | Story source links above | F1, U17 | — |
| M5-9 | When the Healthcare Professionals filter is selected, the interface must provide the Add Professional action. | Yes | Pass | Story source links above | F1, U17 | — |
| M5-10 | When All Users is selected, the interface must provide access to both patient and professional creation. | Yes | Pass | Story source links above | U17 | — |
| M5-11 | Creating a patient must require First Name, Last Name, Email, Password, Confirm Password, Date of Birth, Phone Number, and Address. | Yes | Pass | Story source links above | B8, B2, F1 | — |
| M5-12 | Creating a professional must require First Name, Last Name, Email, Password, Confirm Password, Specialization, License Number, Phone Number, and Workplace. | Yes | Pass | Story source links above | B2, E2 and F1 | — |
| M5-13 | Passwords must satisfy the 10–128 character policy with at least one letter and one digit, and confirmations must match. | Yes | Pass | Story source links above | B1, R1, R17 cover shared password rules and F1 covers client confirmation | — |
| M5-14 | Patient birth dates must be valid and not in the future. | Yes | Pass | Story source links above | B2 and R1 exercise shared patient creation schema | — |
| M5-15 | Phone numbers must contain 7–15 digits. | Yes | Pass | Story source links above | B2 and R15 use same digit-count logic for both roles, E1/E2 valid formatted phone | — |
| M5-16 | Required name, address, workplace, specialization, and license fields must not be accepted as blank or whitespace-only. | Yes | Pass | Story source links above | B1, B2, R1, R15 cover shared and role-specific validators | — |
| M5-17 | Invalid email formats and duplicate email addresses must be rejected. | Yes | Pass | Story source links above | B8, R15, B1 invalid format | — |
| M5-18 | Duplicate professional license numbers must be rejected. | Yes | Pass | Story source links above | B5, R15 | — |
| M5-19 | Creating a patient must create a USERS record with Role = `patient` and a corresponding PATIENT_PROFILES record. | Yes | Pass | Story source links above | B8 | — |
| M5-20 | Creating a professional must create a USERS record with Role = `professional` and a corresponding PROFESSIONAL_PROFILES record. | Yes | Pass | Story source links above | B2, B5, E2 | — |
| M5-21 | Creating either account type must securely hash the password and save account/profile information consistently. | Yes | Pass | Story source links above | B8 explicitly checks patient Argon2; B2 and B5 professional role/link and same transactional service | — |
| M5-22 | Newly created patients must be able to log in as patients, and newly created professionals must be able to log in as professionals. | Yes | Pass | Story source links above | B8, B5, E2 | — |
| M5-23 | Administrators must be able to edit supported professional profile information. | Yes | Pass | Story source links above | R15 and edit action source. Browser professional edit not directly asserted | — |
| M5-24 | Administrators must be able to deactivate active patient and professional accounts. | Yes | Pass | Story source links above | B3 and R9 exercise both roles' status updates | — |
| M5-25 | Administrators must be able to reactivate inactive patient and professional accounts. | Yes | Pass | Story source links above | R9 reactivates both through PATCH | — |
| M5-26 | Deactivated users must not be able to log in or use protected APIs as active users. | Yes | Pass | Story source links above | B3 and R9 reject deactivated login and existing session | — |
| M5-27 | Administrator account statuses must not be modifiable through the ordinary patient/professional status-management action. | Yes | Pass | Story source links above | R9 administrator status change rejected, UI hides action | — |
| M5-28 | Users with patient or professional roles must not be able to call administrator endpoints, even by submitting requests directly. | Yes | Pass | Story source links above | R3 full role matrix | — |
| M5-29 | The interface must show success messages after saved operations and errors after rejected operations. | Partial | Fail | Story source links above | E2 verifies creation and U29 status updates, but U29b reproduces concurrent prior success and new error, D10 | Clear old success state before starting a new mutation. |
| M5-30 | The Administrator Dashboard and Manage Users pages must follow the provided NeuroAdapt UI designs. | Partial | Blocked | Story source links above | V12 shows Manage Users visual differences. No titled Administrator Dashboard Figma reference supplied, Q1 | Supply the Administrator Dashboard design and approve Manage Users differences. |

### Backend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| M5-B1 | `GET /api/admin/users` returns user information for authorized administrators. | Yes | Pass | Backend and database above | R3 authorized U28 | — |
| M5-B2 | `POST /api/admin/patients` creates patient accounts with required patient information. | Yes | Pass | Backend and database above | B8, B2 | — |
| M5-B3 | `POST /api/admin/professionals` creates professional accounts with required professional information. | Yes | Pass | Backend and database above | B2, B5, R15 | — |
| M5-B4 | `PUT /api/admin/professionals/{professional_id}` updates supported professional information. | Yes | Pass | Backend and database above | R15 | — |
| M5-B5 | `PATCH /api/admin/users/{user_id}/status` changes permitted patient/professional statuses. | Yes | Pass | Backend and database above | B3, R9 | — |
| M5-B6 | Invalid, incomplete, or duplicate account information is rejected. | Yes | Pass | Backend and database above | B2, B8, R15 | — |
| M5-B7 | Passwords are securely hashed, and account/profile creation is transactional. | Yes | Pass | Backend and database above | B8 verifies Argon2 for patient, R21 forces and verifies rollback for both admin creation routes. Same hashing service for both roles | — |
| M5-B8 | New accounts have the correct role and linked profile. | Yes | Pass | Backend and database above | B2, B8, B5 | — |
| M5-B9 | Non-administrators are denied access to all administration endpoints. | Yes | Pass | Backend and database above | R3 all routes | — |
| M5-B10 | Administrator accounts cannot be deactivated through the ordinary status endpoint. | Yes | Pass | Backend and database above | R9 | — |

### Frontend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| M5-F1 | Dashboard summaries reflect saved database records. | Yes | Pass | Frontend above and its API | U28 | — |
| M5-F2 | User lists, search, and filters work. | Yes | Pass | Frontend above and its API | U17 and V12 | — |
| M5-F3 | Patients filter displays Add Patient. | Yes | Pass | Frontend above and its API | F1, U17 | — |
| M5-F4 | Healthcare Professionals filter displays Add Professional. | Yes | Pass | Frontend above and its API | F1, U17 | — |
| M5-F5 | All Users provides both creation options. | Yes | Pass | Frontend above and its API | U17 | — |
| M5-F6 | Patient and professional forms display the correct role-specific fields. | Yes | Pass | Frontend above and its API | F1, E2 | — |
| M5-F7 | Required fields and invalid values display validation errors. | Yes | Pass | Frontend above and its API | F1 native/confirmation feedback and R15 API validation, shared error renderer verified by F2 | — |
| M5-F8 | Successful creation and status changes update the interface. | Yes | Pass | Frontend above and its API | E2, F1 and U29 | — |
| M5-F9 | Only authorized administrators can use the pages. | Yes | Pass | Frontend above and its API | F2, U4, R3 | — |
| M5-F10 | The interface follows the supplied Figma design. | Partial | Blocked | Frontend above and its API | V12 compared. Admin Dashboard reference absent, Q1 | Supply the Administrator Dashboard design and approve Manage Users differences. |

## M6 — Patient and Healthcare Professional Assignment Management

Frontend: [App.jsx](../frontend/src/App.jsx), [AdminPages.jsx](../frontend/src/AdminPages.jsx), [ProfessionalPages.jsx](../frontend/src/ProfessionalPages.jsx), [components.jsx](../frontend/src/components.jsx). Backend: [routers/admin.py](../backend/app/routers/admin.py), [routers/monitoring.py](../backend/app/routers/monitoring.py), [services/medications.py](../backend/app/services/medications.py), [core/security.py](../backend/app/core/security.py), [schemas/__init__.py](../backend/app/schemas/__init__.py). Database: [schema.sql](../database/schema.sql), [models](../backend/app/models/__init__.py) and [initial migration](../backend/alembic/versions/0001_initial.py), especially USERS, PATIENT_PROFILES, PROFESSIONAL_PROFILES, PATIENT_PROFESSIONALS.

### User Story acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| M6-1 | Only authenticated administrators must be able to open the Assignments management page and use its corresponding API endpoints. | Yes | Pass | Story source links above | R3 API matrix, E2 admin navigation, common route gate U4 | — |
| M6-2 | The page must display existing patient-professional assignments retrieved from the database. | Yes | Pass | Story source links above | E2 and U18, R12–R13 persisted API rows | — |
| M6-3 | Administrators must be able to select an active patient and an active healthcare professional when creating an assignment. | Yes | Pass | Story source links above | E2 selects active accounts, R9 validates eligibility | — |
| M6-4 | Attempting to create an assignment without selecting a patient must be rejected. | Yes | Pass | Story source links above | U18 required select, R9 API 422 | — |
| M6-5 | Attempting to create an assignment without selecting a healthcare professional must be rejected. | Yes | Pass | Story source links above | U18 required select, R9 API 422 | — |
| M6-6 | Assignments must not be created for nonexistent patient or professional IDs. | Yes | Pass | Story source links above | R9 unknown IDs rejected | — |
| M6-7 | Assignments must not be created using inactive patient or professional accounts. | Yes | Pass | Story source links above | R9 both inactive role cases rejected | — |
| M6-8 | Submitting a valid new patient-professional pair must create a PATIENT_PROFESSIONALS record. | Yes | Pass | Story source links above | B5, R12 | — |
| M6-9 | A newly created assignment must have Status = `active`, an AssignedAt date/time, and no UnassignedAt value until deactivation. | Yes | Pass | Story source links above | R12 verifies status and date fields | — |
| M6-10 | The newly assigned patient must become available in the corresponding professional's My Patients list after refreshing. | Yes | Pass | Story source links above | B5, E2, R12 | — |
| M6-11 | The assigned professional must be authorized to access that patient's profile and medication history. | Yes | Pass | Story source links above | B5 and R12 detail/history | — |
| M6-12 | Creating an identical patient-professional pair while an active assignment already exists must be rejected. | Yes | Pass | Story source links above | B5, R12 duplicate returns 409 | — |
| M6-13 | A duplicate active assignment request must not create multiple active rows for the same pair. | Yes | Pass | Story source links above | R12 checks the stored count | — |
| M6-14 | Concurrent duplicate assignment attempts must not produce more than one active assignment for the same pair. | Yes | Blocked | Story source links above | SQLite cannot exercise production InnoDB row locking. D7 | Run concurrent duplicates on disposable MariaDB with separate connections. |
| M6-15 | A patient may be assigned to more than one healthcare professional. | Yes | Pass | Story source links above | R12 creates second professional assignment to same patient | — |
| M6-16 | A healthcare professional may be assigned to more than one patient. | Yes | Pass | Story source links above | R12 creates second patient assignment to same professional | — |
| M6-17 | Administrators must be able to deactivate an active assignment. | Yes | Pass | Story source links above | B5, R13 | — |
| M6-18 | Deactivation must change the assignment to inactive and record the UnassignedAt date/time. | Yes | Pass | Story source links above | R13 persists inactive status and timestamp | — |
| M6-19 | Deactivated assignments must remain stored as historical records rather than being permanently deleted. | Yes | Pass | Story source links above | B5, R13, U18 | — |
| M6-20 | After an assignment is deactivated, the professional must lose monitoring access based on that assignment. | Yes | Pass | Story source links above | B5, R13 | — |
| M6-21 | A previously assigned patient and professional must be eligible for reassignment after their previous assignment becomes inactive. | Yes | Pass | Story source links above | B5, R13 | — |
| M6-22 | Reassignment must create a new active relationship while preserving the previous historical record. | Yes | Pass | Story source links above | B5 asserts two rows and historical status after reassignment, R13 | — |
| M6-23 | The assignment list must distinguish active from inactive/historical assignments. | Yes | Pass | Story source links above | U18 and V13 | — |
| M6-24 | Users with patient or professional roles must not be able to create, deactivate, or otherwise manage assignments. | Yes | Pass | Story source links above | R3 | — |
| M6-25 | Successful assignment operations must display appropriate confirmation, while duplicate, invalid, or unauthorized actions must display clear error feedback. | Partial | Fail | Story source links above | E2 success, U30 duplicate error, R3 and R9 rejected actions. U30c reproduces stale success with rejected deactivation, D10 | Clear old success state before starting a new mutation. |
| M6-26 | The Assignments page must follow the provided Figma design. | Partial | Fail | Story source links above | V13 shows matching creation controls and material differences in assignment table and available actions, D6 | Reconcile patient-centric mockup actions with historical assignment management. |

### Backend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| M6-B1 | `GET /api/admin/assignments` retrieves saved assignments. | Yes | Pass | Backend and database above | B5, R12–R13 | — |
| M6-B2 | `POST /api/admin/assignments` creates a valid active assignment. | Yes | Pass | Backend and database above | B5, R12 | — |
| M6-B3 | Missing, invalid, or inactive accounts are rejected. | Yes | Pass | Backend and database above | R9 | — |
| M6-B4 | Duplicate active assignments return HTTP 409 Conflict without creating another active row. | Yes | Pass | Backend and database above | B5, R12 | — |
| M6-B5 | Concurrent duplicate requests result in no more than one active assignment. | Yes | Blocked | Backend and database above | InnoDB concurrency not tested, D7 | Run concurrent duplicates on disposable MariaDB with separate connections. |
| M6-B6 | `DELETE /api/admin/assignments/{assignment_id}` deactivates an assignment without deleting its historical record. | Yes | Pass | Backend and database above | B5, R13 | — |
| M6-B7 | Deactivation records the inactive status and unassignment time. | Yes | Pass | Backend and database above | R13 | — |
| M6-B8 | Reassignment is allowed after the earlier assignment becomes inactive. | Yes | Pass | Backend and database above | B5, R13 | — |
| M6-B9 | Professional monitoring authorization reflects current active assignments. | Yes | Pass | Backend and database above | R12–R14 | — |
| M6-B10 | Non-administrator requests are rejected. | Yes | Pass | Backend and database above | R3 | — |

### Frontend child-task acceptance criteria

| Criterion | Expected behavior | Implemented | Tested | Relevant code | Evidence and discrepancy | Suggested correction or verification |
| --- | --- | --- | --- | --- | --- | --- |
| M6-F1 | The page displays existing assignments from the API. | Yes | Pass | Frontend above and its API | E2, U18 | — |
| M6-F2 | The assignment form lists eligible active patients and professionals. | Yes | Pass | Frontend above and its API | E2 and source filters only active role options. R9 tests backend inactive cases | — |
| M6-F3 | Required selections are validated. | Yes | Pass | Frontend above and its API | U18 | — |
| M6-F4 | Creating a valid assignment updates the displayed list. | Yes | Pass | Frontend above and its API | E2 and source reload, U18 persisted list | — |
| M6-F5 | Duplicate assignments display an error. | Yes | Pass | Frontend above and its API | U30 actual browser duplicate conflict and B5 API 409 | — |
| M6-F6 | Administrators can deactivate an assignment. | Yes | Pass | Frontend above and its API | U30b browser and R13 stored state | — |
| M6-F7 | Inactive assignments remain visible as historical records where the interface supports them. | Yes | Pass | Frontend above and its API | U18 | — |
| M6-F8 | Validation, success, and error messages appear correctly. | Partial | Fail | Frontend above and its API | E2/U18 positive and required-field paths; stale confirmation on rejected deactivation, D10/U30 | Clear old success state before starting a new mutation. |
| M6-F9 | The page follows the provided Figma layout and styling. | Partial | Fail | Frontend above and its API | V13 and D6 | Reconcile patient-centric mockup actions with historical assignment management. |


## Summary by User Story

The first four columns are test outcomes. The five findings categories are represented by Pass (verified and passed), Confirmed defects, Missing implementation, Implemented but untested, and Needs clarification. Implemented but untested includes the MariaDB concurrency blocker. Blocked design criteria count under Needs clarification.

| User Story | Pass | Fail | Not Tested | Blocked | Confirmed defects | Missing implementation | Implemented but untested | Needs clarification |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| G1 Patient Registration | 16 | 2 | 0 | 0 | 1 | 1 | 0 | 0 |
| G2 Patient and Professional Profile Management | 17 | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| G3 Patient Dashboard | 13 | 2 | 0 | 0 | 0 | 2 | 0 | 0 |
| G4 Patient Medication Management | 16 | 1 | 2 | 0 | 1 | 0 | 2 | 0 |
| G5 Medication Intake Recording | 18 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| G6 Medication History Tracking | 17 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| M1 User Login and Authentication | 21 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| M2 Forgot Password and Password Reset | 25 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| M3 Healthcare Professional Dashboard and Assigned Patients | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| M4 Healthcare Professional Patient Monitoring | 19 | 1 | 1 | 0 | 1 | 0 | 1 | 0 |
| M5 Administrator Dashboard and User Management | 28 | 1 | 0 | 1 | 1 | 0 | 0 | 1 |
| M6 Patient and Healthcare Professional Assignment Management | 23 | 2 | 0 | 1 | 2 | 0 | 1 | 0 |
| **Total parent criteria** | **233** | **11** | **3** | **2** | **7** | **4** | **4** | **1** |

### Child-task totals

| User Story | Pass | Fail | Not Tested | Blocked |
| --- | ---: | ---: | ---: | ---: |
| G1 | 11 | 1 | 1 | 0 |
| G2 | 10 | 2 | 0 | 0 |
| G3 | 9 | 1 | 0 | 0 |
| G4 | 12 | 0 | 2 | 0 |
| G5 | 13 | 1 | 0 | 0 |
| G6 | 12 | 0 | 0 | 0 |
| M1 | 14 | 0 | 0 | 0 |
| M2 | 15 | 0 | 0 | 0 |
| M3 | 13 | 0 | 0 | 0 |
| M4 | 12 | 0 | 1 | 0 |
| M5 | 19 | 0 | 0 | 1 |
| M6 | 16 | 2 | 0 | 1 |
| **Total child criteria** | **156** | **7** | **4** | **2** |
