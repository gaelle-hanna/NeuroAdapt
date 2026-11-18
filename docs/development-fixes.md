# NeuroAdapt development fixes

Verified 18 November 2026. This follow-up records changes against the original [acceptance criteria audit](acceptance-criteria-audit.md).

## Corrected issues

| Issue | Change | Regression evidence |
| --- | --- | --- |
| D1 | Account creation and patient, professional, and administrator-managed profile updates share one phone validator. A supplied phone must contain 7–15 ASCII digits. Optional edit fields can still be cleared. | Backend tests exercise patient and professional creation and self-update, reject invalid input without overwriting the saved value, and verify clearing an optional phone. Edge verifies native rejection and successful save and reload. |
| D2 | The Patient Dashboard links directly to My Medications and shows the current patient's total saved entries, including inactive entries. Medication count has its own loading and retry state. Existing intake, latest-medication and account summaries retain their original definitions. | Edge follows the link, creates a medication, revisits the dashboard, sees the count increase from zero to one, and confirms history is still empty. |
| D3 | Medication add and edit confirmation is held by the page, so a successful edit remains confirmed after the editor closes. | Edge checks the confirmation and the persisted edited frequency. |
| D4 | The intake form displays the red in-page validation message from reference 18 when native validation rejects missing or invalid input. Native focus and validity behavior and API validation remain in effect. | Edge checks the banner and native focus, verifies no intake request was sent, then completes a valid submission and verifies the banner clears. |
| D8 | The browser accepts spaces, parentheses, hyphens and an optional leading plus. The API preserves valid formatting up to 20 characters and compacts longer valid values to digits plus the optional leading plus. Both fit the current phone column. | Backend verifies short formatting, long formatting, both ends of the digit-count range, and rejected character forms. Edge submits a number that exceeded the former input limit and verifies safe storage and display. No migration was needed. |
| D10 | User management, assignments and medication management clear previous page feedback before submitting a new operation. Related mutation controls are disabled while a request is pending to prevent competing notices. | Edge verifies medication edit success followed by rejected deactivation, successful account status changes followed by failure, and successful assignment creation followed by rejected deactivation or duplicate creation. The current error appears without the earlier success. |

## Previously untested checks

| Criteria | Result |
| --- | --- |
| G1-F5 | **Pass.** Duplicate registration shows a conflict error in Edge and remains on the registration page. |
| G4-15, G4-18, G4-F3, G4-F6 | **Pass.** The standalone medication page shows its empty state. Missing required fields prevent submission. A failed mutation shows an error without the earlier success and leaves the displayed state unchanged. |
| M4-12, M4-F4 | **Pass.** An assigned patient's monitoring page displays the patient profile alongside the empty medication history. The audit's existing loading check still applies. |
| M6-14, M6-B5 | **Blocked.** No disposable MariaDB server was reachable. The configured Docker engine and Docker Desktop Linux engine pipes were unavailable, and no local MariaDB listener was found. SQLite sequential duplicate assignment returns a conflict. InnoDB concurrency remains unverified. |

## Test runs

| Suite | Command | Actual result |
| --- | --- | --- |
| Backend | From `backend`, `.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --tb=no --no-summary` | **35 passed**, one warning. Includes two new role-parameterized phone cases. |
| Frontend components | From `frontend`, `node node_modules/vitest/vitest.mjs run --configLoader runner --reporter=dot` | **13 passed.** |
| Browser | From `frontend`, `node node_modules/playwright/cli.js test --trace off --output <disposable-output>` | **5 passed** in Edge. Includes all three pre-existing tests and both new [regression workflows](../tests/e2e/development-fixes.spec.js). |

The browser run used the real frontend and API, synthetic accounts, and a separate SQLite test database with foreign keys enabled. It used local development reset links and sent no email. Failure feedback was tested with intercepted HTTP 503 responses and an actual duplicate assignment conflict.

D5, D6 and D9 remain pending design or requirements decisions. The Administrator Dashboard Figma reference is still unavailable. The seven-table ERD, original audit, project documentation and Figma exports were preserved.
