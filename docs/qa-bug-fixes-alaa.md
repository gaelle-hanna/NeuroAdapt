# Alaa QA bug fixes

Developer verification on 25 November 2026, on `fix/alaa-qa-bugs`. Reviewed all seven pages of Alaa Hassan's M2–M6 QA report, including the evidence, and compared the findings with the supplied Azure DevOps requirements export. QA data was synthetic and the live checks used disposable Docker MariaDB 11.4 databases. Independent retesting by Alaa and Azure Boards status changes remain separate.

## BUG-A01 — Forgot-password timing information leak

**Status — Fixed for the synchronous SMTP delay.** Alaa reported identical public responses but a registered-address timing difference. Against an isolated copy of the branch base in production mode, a local SMTP stub that delayed its STARTTLS reply by 1.2 seconds produced one observed pair of 30 ms unknown and 1,271 ms registered. Both returned HTTP 200 and identical generic JSON. The account lookup and reset-token writes ran inline, and the known-account path also waited for SMTP.

**Correction and file.** `backend/app/routers/auth.py` now schedules SMTP delivery as a FastAPI background task after the transaction commits. The SMTP task preserves the generic, credential-free delivery-failure log. Token generation, hashing, expiry, reuse protection, rate limiting and the explicit development-only reset link retain their existing behavior. Account lookup and token writes remain on the request path. This change removes the SMTP delay from the measured response, and residual database timing remains possible. Delivery is in-process and has no durable retry queue.

**Developer tests and result.** With the same configured delay on disposable MariaDB in production mode, the observed unknown/registered pairs were 25/22 ms and 24/24 ms, with matching HTTP status and JSON. The local STARTTLS stub accepted a reset email, its link reset the synthetic password once, and replay returned HTTP 400. A subsequent stub failure was recorded with the generic log message. These observations establish the delayed SMTP work was outside the response path and do not establish timing equivalence. The new `backend/tests/test_alaa_qa_bugs.py` verifies ASGI response ordering, sanitized failure logging and single-use delivery. The existing reset workflow checks expiry and reset behavior.

**Alaa retest.** Use production settings with a disposable MariaDB instance and local SMTP stub. Alternate registered and unknown synthetic addresses within the rate limits. Compare status, body, security headers and timing across repeated trials with and without deliberate SMTP delay. Confirm delivery, one-time use, and generic public feedback after simulated SMTP failure. Keep tokens and addresses out of shared evidence.

## BUG-A02 — Optional professional edit fields

**Status — Pending Requirement Decision.** No changes. Alaa observed that an administrator could save an edited professional with a blank Workplace and Phone. Code inspection confirms that the edit form makes the fields optional and the `ProfessionalProfile` schema permits a null phone and an empty or null workplace. The creation form and `CreateProfessional` require both.

**Requirements and evidence.** M5 AC12 explicitly lists Phone and Workplace as required for creation. AC16 prevents required fields from being blank, and AC23 requires supported professional editing without enumerating edit-required fields. That leaves a gap between the QA expectation of matching creation rules and the edit requirements. This finding was reviewed against the requirements and implementation. No new edit-specific execution was performed.

**Alaa retest.** Once the edit policy is decided, use a synthetic professional to compare blank and whitespace-only edits with creation, then reload to verify the saved values or rejection according to the approved rule.

## BUG-A03 — Stale administrator form feedback

**Status — Fixed.** On the baseline, the duplicate-email alert in Manage Users remained after a successful status update, and the duplicate-assignment alert remained after successful deactivation. In both pages, form feedback is owned by `Form`, while row operations only cleared their page-level notices.

**Correction and files.** `frontend/src/AdminPages.jsx` signals the relevant form to clear prior feedback when a status change or assignment deactivation starts. `frontend/src/components.jsx` handles that signal without remounting or clearing form inputs. Form submission still clears prior page feedback.

**Developer tests and result.** `tests/e2e/alaa-qa-bugs.spec.js` exercises both directions in Manage Users and Assignments using live requests. Manage Users success was removed by the subsequent duplicate error, then successful activation cleared the error while preserving the entered email. Assignment success was removed by a duplicate error, then successful deactivation cleared the error. Existing row-mutation failure tests also ran.

**Alaa retest.** On each page, first trigger the duplicate form error and then perform a row action successfully. Repeat in the opposite sequence. Check that only the latest notice remains and that a row action leaves unsaved form inputs intact where the form stays mounted.

## BUG-A04 — Technical validation messages

**Status — Fixed.** On the baseline, Forgot Password showed a raw email-validator diagnostic. Reset Password and administrator patient creation showed the leading colon and Pydantic `Value error,` prefix for a password without digits. The API client formerly concatenated the field location and message for each validation detail, even when the field location was empty.

**Correction and file.** `frontend/src/api.js` formats HTTP 422 validation details only for Forgot Password, Reset Password, and administrator patient or professional creation. It supplies a plain email format example, drops the Pydantic prefix and empty field location, and keeps meaningful validation guidance. HTTP statuses, backend response contracts and unrelated error handling are preserved.

**Developer tests and result.** Live Playwright checks in `tests/e2e/alaa-qa-bugs.spec.js` verified the plain email message, the Reset Password rule, and the same rule in both administrator creation forms using actual backend responses.

**Alaa retest.** Submit an address missing its domain suffix on Forgot Password. Use a synthetic reset link and a password of letters only. Repeat the password test in both administrator creation forms. Check that each form explains the correction and displays no leading colon or Pydantic prefix.

## BUG-A05 — Invalid patient monitoring ID

**Status — Fixed.** On the baseline, a professional opening `/professional/patients/abc` received the raw integer validation feedback and retry UI. `PatientMonitoring` passed the segment directly to FastAPI and only mapped HTTP 403 to Access Denied.

**Correction and files.** `frontend/src/ProfessionalPages.jsx` detects a malformed ID before fetching and uses the existing Access Denied view. `frontend/src/components.jsx` lets `useData` skip that request. The backend monitoring routers, numeric ID handling and authorization remain unchanged. The earlier numeric 403-versus-404 requirement question is outside this fix.

**Developer tests and result.** Playwright opened malformed, unknown numeric and unassigned numeric routes as a synthetic professional. All three showed Access Denied, with no API request for the malformed ID and no retry button. The backend test in `backend/tests/test_alaa_qa_bugs.py` confirms the same generic HTTP 403 response for unknown and unassigned numeric IDs.

**Alaa retest.** Sign in as a synthetic professional with one assigned patient. Check `abc`, an unknown numeric ID, an unassigned numeric ID and the assigned numeric ID. The first three should show Access Denied without patient data, and the assigned record should still load.

## BUG-A06 — Minimum birth date

**Status — Pending Requirement Decision.** No changes. Alaa reports that valid but implausibly early dates were stored. Code inspection shows that `PatientProfile.past_birth` rejects future dates, that account creation reuses the validator, and that the date input has a maximum of today.

**Requirements and evidence.** M5 AC14 calls for a valid date that is not in the future. Public registration G1 AC8 uses the same rule. Neither specifies a minimum date or maximum patient age. No fresh database write was needed for this review-only finding.

**Alaa retest.** If a lower bound is approved, retest the exact boundary and the adjacent date in both public registration and administrator patient creation. Continue checking that malformed and future dates are rejected.

## Developer regression runs

| Suite | Observed result |
| --- | --- |
| Backend pytest (`backend/.venv/Scripts/python.exe -m pytest -q` from `backend`, using the existing SQLite fixtures) | 39 passed, including 4 new regressions. One existing Starlette/AnyIO deprecation warning. |
| Frontend Vitest and production build (`npm test`, `npm run build` from `frontend`) | 13 passed. Build succeeded. |
| Playwright Edge on disposable migrated MariaDB | 11 passed, including 6 new regressions in `tests/e2e/alaa-qa-bugs.spec.js`. Those same six assertions failed on the unmodified baseline in the reported scenarios. |
| Existing local M1 QA scripts on a separate disposable migrated MariaDB | 12 live API tests and 8 Edge tests passed. These pre-existing local scripts are outside this commit. |
| Production-mode FastAPI on disposable migrated MariaDB with the local SMTP stub | Public response, delayed SMTP, STARTTLS email receipt, one-time reset and sanitized SMTP failure checks passed. |

The first live browser run used a reset-link origin outside the isolated Vite instance. The next run combined the live M1 API requests with browser requests under one rate-limit window and reached the existing login cap. The final browser run used the correct isolated frontend origin and a fresh window, and all 11 passed without application or test expectation changes for those harness issues.

To rerun the standard browser suite, follow the existing README setup against a fresh disposable MariaDB database. Provide only synthetic administrator credentials in `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`, and enable development reset links with SMTP disabled for those browser scenarios. Use `npm run test:e2e` from `frontend`. Run the separate production SMTP check with development reset links disabled.
