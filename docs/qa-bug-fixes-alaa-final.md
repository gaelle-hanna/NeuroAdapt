# Alaa QA bug fixes: BUG-A02 and BUG-A06

Developer verification on 25 November 2026. The clarified requirements supplied for this work govern these two fixes. The earlier QA report and the previous fix report remain historical records. Independent QA verification by Alaa is pending.

## BUG-A02 — Required phone and workplace on professional edits

**Original problem.** Administrator edits in Manage Users and self-edits in My Profile both used a schema that permitted missing professional contact information. The edit forms also treated Phone and Workplace as optional.

**Correction.** In `backend/app/schemas/__init__.py`, `ProfessionalProfile` now requires a phone using the existing `Phone` validator and a trimmed, nonblank workplace using the creation field's existing 150-character limit. Both edit routes already accept a full profile by PUT, so omitted mandatory fields are rejected just like null or invalid fields. No partial-update endpoint was added. In `frontend/src/PatientPages.jsx`, `RoleDetailsFields` requires Phone and Workplace for professionals and adds a nonblank workplace check for edits. These controls use native validation and keep the entered values available for correction. In `frontend/src/AdminPages.jsx`, `ManageUsers` no longer converts a blank professional edit phone to null. Professional creation keeps its existing rules.

**Developer checks.** The targeted pytest cases used both edit routes. Empty, whitespace-only, null and omitted required values were rejected with HTTP 422. Invalid phone formats were rejected, and stored values remained intact. Formatted valid phone values were accepted and saved. Edge verified that each editor blocked invalid submissions, preserved the entered workplace, and successfully saved a corrected profile.

**Alaa retest.** Using a synthetic professional, open Manage Users and edit the account. Try blank Phone and blank or spaces-only Workplace separately. Confirm validation feedback, retained inputs, and unchanged saved values after reload. Correct both fields, using a valid formatted phone, and save. Repeat from My Profile as that professional. For direct API verification, submit null Phone to each PUT route and expect HTTP 422 with the saved phone unchanged.

## BUG-A06 — Inclusive patient birth-date bounds

**Original problem.** The backend rejected future dates but accepted valid calendar dates before 1900. The browser date controls had a maximum but no minimum.

**Correction.** In `backend/app/schemas/__init__.py`, `PatientProfile.past_birth` rejects dates earlier than 1900-01-01. The existing dynamic upper bound and calendar-date parsing remain in effect. The rule covers public registration, administrator patient creation, and patient self-editing through the existing schemas. There is no administrator patient-edit endpoint. In `frontend/src/PatientPages.jsx`, the shared date input sets the minimum to 1900-01-01 and retains the dynamically calculated maximum. The browser uses native validation to block out-of-range submission and explain the range.

**Developer checks.** For each supported API flow, pytest rejected 0001-01-01, 1800-01-01, 1899-12-31, tomorrow, and an invalid calendar date. It accepted 1900-01-01, an intermediate date, and today. Rejected creation attempts did not increase the user count, and invalid edits left the stored birth date intact. Edge verified the minimum and current-day maximum, native validation on submission, and validity of the inclusive boundaries on all three screens.

**Alaa retest.** Try an out-of-range date on registration, administrator patient creation, and My Profile. Verify that the browser stops submission and shows validation feedback. Try 1900-01-01 and today's date as accepted boundaries. Use direct requests for the remaining date cases above, then confirm rejected requests neither create an account nor alter an existing birth date.

## Test files and scope

- `backend/tests/test_alaa_remaining.py` adds five targeted API tests across the supported routes.
- `backend/tests/test_role_registration.py` updates the former expectation that professional edits could clear the phone. The existing checks for shared phone formatting and optional patient profile phone remain in place.
- `tests/e2e/alaa-remaining.spec.js` adds four Edge tests across the two professional editors and three existing patient date inputs.

Only the three application files listed above changed. Database schema, migrations, existing records, dependencies, authentication, authorization, and unrelated UI and features were outside the diff. The previous four bug fixes were retained and their existing regressions were rerun. No QA status or Azure DevOps work item was updated.

## Execution results

| Suite | Actual result |
| --- | --- |
| Targeted backend pytest | 5 passed with disposable SQLite fixtures. |
| Full backend pytest | 44 passed, including the five targeted tests and existing A01 regressions. The initial run had one outdated assertion that expected null professional phone to be accepted. After updating that directly affected assertion, all tests passed. One existing Starlette/AnyIO deprecation warning remained. |
| Frontend unit tests | 13 passed. |
| Targeted Playwright | 4 passed in Edge with disposable MariaDB. |
| Existing Playwright | 11 passed in Edge with a separate disposable MariaDB instance, including the A03, A04, and A05 regressions. |
| Existing independent M1 QA suite | 12 live API tests and 8 Edge tests passed on disposable MariaDB. |
| Production frontend build | Succeeded. |

The suites used synthetic data. The boundary matrix ran in the backend SQLite fixtures. Live browser and M1 verification used migrated MariaDB. The A01 backend regressions were rerun, and the one-off production SMTP timing experiment from the previous report was outside this run.
