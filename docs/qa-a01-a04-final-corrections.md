# BUG-A01 and BUG-A04 developer verification

This work starts from `e5628dd` on `fix/alaa-ux-findings`, which includes `9aa0069` and `b7db835`. It addresses the remaining issues from Alaa Hassan’s M2–M6 bug report and retest. Independent QA acceptance remains pending.

## BUG-A01 — Forgot Password timing

**Developer status:** Fixed in the controlled single-request production-mode comparison. Behavior under concurrent load or deployed infrastructure remains unverified.

Alaa’s original fast-SMTP run measured medians of **50.5 ms registered** and **21.1 ms unknown**. His later slow-SMTP comparison measured **1304 ms** and **16.6 ms** on master, then **25.6 ms** and **18.7 ms** after SMTP delivery moved out of the response path. In the 40-pair retest, the prior fix measured **22.7 ms** and **15.2 ms**, with about 80% threshold separation. His unknown-versus-unknown control measured **15.7 ms** and **14.6 ms**, with 58.8% separation.

The database trace on `e5628dd` found a locking `SELECT` before the body for both cohorts. Only active accounts also ran `UPDATE`, `INSERT` and `COMMIT` before the body. Lookup costs can differ even when both paths issue a select. The trace identifies the additional transaction work on the registered path. It does not isolate the millisecond cost of each statement.

In `backend/app/routers/auth.py`, the ordinary request now checks the existing rate limit and admits the same type of background task for either cohort without performing account lookup or token work in the handler. After the response, the worker opens its own database session. It locks an eligible account, issues and commits the reset token, closes the session, then can send email. A database failure uses a generic log entry and prevents email delivery. A process-local limit of eight in-flight reset responses and jobs avoids an unbounded queue. If saturated, both account cohorts can receive the existing generic HTTP 503 service error. An accepted request keeps the HTTP 200 generic message. Explicit development reset-link mode with SMTP disabled retains its synchronous link behavior.

### Measured response times

Each row contains 40 paired requests with balanced ordering and synthetic addresses. The FastAPI application ran in production mode against disposable MariaDB 11.4 and a loopback STARTTLS SMTP stub. The first run measured monotonic time to the final ASGI response body. A second run measured end-to-end HTTP time over loopback with Uvicorn and a persistent connection. Each new sample started after the previous background job completed to keep load separate from the single-request comparison. The harness started each independent pair with a fresh in-process rate-limit fixture, then verified the real five-request allowance and sixth-request rejection separately. The comparison uses Alaa’s paired cohort and negative-control design and reports paired latency differences instead of a classification statistic.

| Build and cohorts | Median first cohort | Median second cohort | Median paired difference | First cohort slower |
|---|---:|---:|---:|---:|
| `e5628dd` active / unknown | 13.760 ms | 7.455 ms | +6.087 ms | 39 of 40 |
| `e5628dd` unknown / unknown | 7.345 ms | 7.473 ms | −0.340 ms | 16 of 40 |
| Corrected active / unknown | 1.072 ms | 1.062 ms | +0.008 ms | 21 of 40 |
| Corrected unknown / unknown | 0.838 ms | 0.817 ms | +0.013 ms | 23 of 40 |
| Loopback HTTP `e5628dd` active / unknown | 18.504 ms | 11.059 ms | +6.731 ms | 40 of 40 |
| Loopback HTTP `e5628dd` unknown / unknown | 10.252 ms | 10.224 ms | −0.031 ms | 19 of 40 |
| Loopback HTTP corrected active / unknown | 4.241 ms | 4.428 ms | −0.271 ms | 14 of 40 |
| Loopback HTTP corrected unknown / unknown | 3.967 ms | 4.002 ms | −0.110 ms | 14 of 40 |

In the corrected loopback run, the first cohort was slower in 14 of 40 pairs in both the active-versus-unknown comparison and the control. The active cohort was 0.271 ms faster by paired median, compared with a 0.110 ms advantage for the first unknown cohort in the control. The baseline active cohort had been 6.731 ms slower. The repeated ASGI check also showed sub-millisecond paired differences for both groups (−0.045 ms and −0.037 ms). Neither cohort ran a SQL statement before the body in the instrumented corrected requests. With 1.2 seconds of SMTP stub delay, the production response body was emitted in **2.72 ms** and **3.21 ms** on the two runs. The run does not quantify potential timing through shared resources under concurrent traffic, such as workers occupied by slow SMTP delivery, or through a deployed proxy. In-process background work can be lost if the worker exits before the post-response work completes.

### Reset and email regression

The production-mode disposable MariaDB run verified equal HTTP 200 bodies and headers for active, unknown, inactive, uppercase and repeated requests. Only the active account received mail. It verified the 30-minute expiration in storage, hashed token lookup, earlier-link invalidation, invalid and expired token rejection, one successful reset, rejected reuse, rejection of the old JWT, and successful login with the new password. The SMTP stub accepted the message over STARTTLS, then separately rejected STARTTLS. The failed delivery kept the generic response and logged only a generic failure. The backend tests also verify that a database error does not send an email and that capacity rejection does not issue a token. External SMTP delivery and production-load testing were outside this run.

## BUG-A04 — Already fixed through UX-04

Before any application edits, the targeted Edge tests ran against the application at `e5628dd`. The prior client had flattened Pydantic details into raw strings. UX-04 already retained the structured 422 details and translated the reported field rules at the affected form. All eight remaining scenarios returned real HTTP 422 responses, displayed the following plain messages, retained values, and left the database unchanged. Each of the three forms accepted a corrected submission and persisted its intended change. These cases required no new frontend application code.

| Form | Input | Observed message |
|---|---|---|
| Add professional | Spaces-only First name | First name is required. |
| Add professional | Spaces-only Specialization | Specialization is required. |
| Add professional | Spaces-only License number | License number is required. |
| Add professional | Spaces-only Workplace | Workplace is required. |
| Edit professional | `qa@example` | Enter a valid email address, such as name@example.com. |
| Edit professional | Spaces-only Specialization | Specialization is required. |
| Edit professional | Spaces-only License number | License number is required. |
| Professional My Profile | `qa@example` | Enter a valid email address, such as name@example.com. |

The exact-text checks exclude raw Pydantic messages from these scenarios. The existing browser regressions also verified the previously corrected Forgot Password email message and password-policy messages on Reset Password, Add patient and Add professional.

## Verification and scope

| Check | Result |
|---|---|
| Backend pytest | 46 passed, including the reset regressions. Existing Starlette/AnyIO deprecation warning. |
| Frontend Vitest | 14 passed. |
| Existing Edge regression suite | 15 passed in disposable MariaDB batches, including BUG-A02, A03, A05 and A06. |
| Targeted UX Edge suite | 20 passed, covering all 11 previously fixed findings at both viewports. |
| Exact remaining BUG-A04 Edge suite | 3 tests covering eight inputs passed on `e5628dd` before application changes and again on this branch. |
| Production frontend build | Passed with `npm run build -- --configLoader runner`. |

- `backend/app/routers/auth.py` contains the BUG-A01 response and worker changes.
- `backend/tests/conftest.py` supplies the reset worker with isolated test sessions.
- `backend/tests/test_alaa_qa_bugs.py` verifies BUG-A01 response ordering, token commit before SMTP, saturation, and sanitized failure handling.
- `tests/e2e/alaa-a04-final.spec.js` covers the eight BUG-A04 inputs, persisted state and valid retries.
- `docs/qa-a01-a04-final-corrections.md` records the verification.

The frontend application, schema, migrations, token redemption and unrelated application behavior are identical to `e5628dd`. The original QA reports were preserved. Existing browser suites regenerate their standard local test outputs.

## Independent retest for Alaa

1. On an isolated production-mode instance with disposable MariaDB and a loopback SMTP stub, submit active, unknown, inactive, uppercase and repeated addresses. Verify identical public status, body and headers for admitted requests. Confirm only active accounts receive email. Exercise the normal rate limit separately.
2. With SMTP success and failure, verify the generic response, sanitized logs and delivery only after commit. Use the newest link and verify successful reset, earlier-link invalidation, expired and invalid link rejection, reuse rejection, old-session invalidation and login with the new password. Verify the 30-minute expiry in the disposable database.
3. Repeat the controlled 40-pair timing comparison and 40-pair unknown-versus-unknown control in the same environment. Compare cohort and paired medians. Record transport, SMTP configuration and any concurrent load when interpreting the result.
4. Run each of the eight BUG-A04 inputs above at 1440 × 900 and inspect the Network response for a 422. Verify the plain message, preserved values, unchanged storage and valid retry. Also check Forgot Password with `qa@example` and Reset Password, Add patient and Add professional with matching `abcdefghij` passwords.
5. From `frontend`, run `npm run test:e2e -- alaa-a04-final.spec.js` against the disposable browser environment described in the README. Run `npm run test:e2e -- alaa-ux-findings.spec.js` in a fresh batch to repeat the existing UX checks.
