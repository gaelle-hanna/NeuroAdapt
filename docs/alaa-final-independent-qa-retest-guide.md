# NeuroAdapt independent QA retest for Alaa Hassan

The application build under test is **`264ab16`** on **`fix/alaa-a01-a04-final`**. The branch tip also contains this documentation. The source reports describe Test 1 and previous retests. The checks below are a new independent retest. Enter your own observations and use only disposable local services and invented data.

References include Alaa Hassan’s original M2–M6 bug and test reports and November 27 UX report. The three PDFs were available during guide preparation and are held separately from this Git branch. The repository includes the [initial fixes](qa-bug-fixes-alaa.md), [A02/A06 verification](qa-bug-fixes-alaa-final.md), [UX verification](qa-ux-fixes-alaa.md), [A01/A04 verification](qa-a01-a04-final-corrections.md) and [Windows setup](../README.md).

## A. Check out the application build

Accept the private GitHub repository invitation and sign in using your own account. Open PowerShell in a directory where you can create a new folder. The following checks out the application commit with the guide remaining available on the published branch. A detached checkout is suitable for this disposable test clone.

```powershell
git clone --branch fix/alaa-a01-a04-final --single-branch https://github.com/gaelle-hanna/NeuroAdapt.git NeuroAdapt-Alaa-QA
Set-Location NeuroAdapt-Alaa-QA
git branch --show-current
git log -2 --oneline
git merge-base --is-ancestor 264ab16 HEAD
if ($LASTEXITCODE -ne 0) { throw 'The final application commit is missing.' }
git diff --name-only 264ab16 HEAD
git status --short
```

Confirm the branch name is `fix/alaa-a01-a04-final`, the only path in the comparison is this guide, and status is empty. You can test this branch tip because the code matches `264ab16`. Record the tip hash from `git rev-parse --short HEAD` and the application commit `264ab16`. If your test workbook requires the exact HEAD, run the following in the dedicated QA clone and record the detached state and source branch. Keep this guide open on GitHub first.

```powershell
git switch --detach 264ab16
git rev-parse --short HEAD
git status --short
```

For an existing QA clone with an empty `git status --short` and the expected origin, run `git fetch origin refs/heads/fix/alaa-a01-a04-final` and `git switch --detach FETCH_HEAD`. Verify `264ab16` is an ancestor and check the guide-only difference with the same commands above. If status shows any changes, use the separate clone. The baseline `master` branch is for historical comparison only.

## B. Start a disposable Windows QA environment

Install Git, Python 3.10 or later, Node.js 22.12 or later, Microsoft Edge and Docker Desktop with Linux containers. From the QA clone root, check `python --version`, `node --version` and `docker version`. Use available ports 3306, 8000 and 5173. If a service is already using one of those ports, close only your own known QA instance or use a separate test machine.

```powershell
python -m venv backend\.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed.' }
if (Test-Path backend\.env) { throw 'Use a fresh QA clone or review your existing disposable settings.' }
$dbPassword = & .\backend\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(24))"
$jwtSecret = & .\backend\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
if (-not $dbPassword -or -not $jwtSecret) { throw 'Secret generation failed.' }
$env:MARIADB_PASSWORD = $dbPassword
$env:MARIADB_RANDOM_ROOT_PASSWORD = '1'
try {
    docker run --detach --name neuroadapt-alaa-final-db --publish 127.0.0.1:3306:3306 --env MARIADB_DATABASE=neuroadapt --env MARIADB_USER=neuroadapt --env MARIADB_PASSWORD --env MARIADB_RANDOM_ROOT_PASSWORD --health-cmd "healthcheck.sh --connect --innodb_initialized" --health-interval 5s --health-timeout 5s --health-retries 12 mariadb:11.4
    if ($LASTEXITCODE -ne 0) { throw 'MariaDB startup failed.' }
    $config = (Get-Content -Raw backend\.env.example).Replace('CHANGE_ME', $dbPassword).Replace('REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS', $jwtSecret).Replace('DEV_RESET_LINKS=false', 'DEV_RESET_LINKS=true')
    Set-Content -LiteralPath backend\.env -Value $config -Encoding UTF8
} finally {
    Remove-Item Env:MARIADB_PASSWORD, Env:MARIADB_RANDOM_ROOT_PASSWORD -ErrorAction SilentlyContinue
    Remove-Variable dbPassword, jwtSecret, config -ErrorAction SilentlyContinue
}
git check-ignore backend/.env
docker inspect --format '{{.State.Health.Status}}' neuroadapt-alaa-final-db
```

Repeat the health inspection until it prints `healthy`. Keep this ignored, generated environment file private. In the first terminal at the clone root, migrate then start FastAPI:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m alembic upgrade head
if ($LASTEXITCODE -ne 0) { throw 'Migration failed.' }
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

In a second terminal at the clone root:

```powershell
Set-Location frontend
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
npm.cmd run dev
```

In a third terminal, both health requests should return `status: ok` and `database: connected`. Open Edge at `http://127.0.0.1:5173/login` and confirm the login screen renders. Swagger is at `http://127.0.0.1:8000/docs`.

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
Invoke-RestMethod http://127.0.0.1:5173/api/health
Set-Location backend
.\.venv\Scripts\python.exe -m app.cli create-admin
```

Create an administrator such as `qa-admin@example.com`. Choose your own disposable password at the prompt. Sign in and use **Manage Users → Add patient** and **Add professional**. Supply invented names, unique `@example.com` addresses, a synthetic phone such as `+15550101234`, a real calendar date such as `1980-01-01`, and invented address, specialty, workplace and license values. Enter a disposable password that satisfies the on-screen rule and keep it out of notes and screenshots.

For UX fixtures, create at least 18 users including two professionals near the bottom of the filtered list. Create at least 18 active assignments between distinct patient–professional pairs using **Assignments → Save assignment**. As a patient, open **Dashboard → My Medications**, create at least 18 distinguishable entries and record an intake against a medication near the bottom before deactivating it. Use repeating number suffixes such as 01–18 to find rows. A tracked Playwright suite can also seed 18 synthetic professionals, medications and assignments per viewport using the disposable database. Keep eligible active rows available for a second viewport and separate accounts for reset experiments.

When finished, stop the Vite and Uvicorn terminals with Ctrl+C, stop your SMTP fixture if used, and run `docker stop neuroadapt-alaa-final-db`. That preserves QA data locally for a later `docker start neuroadapt-alaa-final-db`. Restore development settings by closing the dedicated production-mode shell described below. Keep evidence outside the repo or within ignored `tmp/`. Leave generated secrets and databases out of Git.

## C. BUG-A01 — Password-reset privacy and timing

### Select the available tests

From `backend`, run the repository’s targeted behavior and saturation checks. They use isolated test fixtures. The production-mode loopback timing harness and STARTTLS stub used for developer measurement were local tooling and are **absent from the tracked repository**. The commands below cannot produce 40-pair timings. Use Alaa’s existing approved local fixture if available or record the production SMTP and timing portions as **Blocked** and identify the missing fixture. Keep the functional automated results separate.

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests/test_alaa_qa_bugs.py -k a01
.\.venv\Scripts\python.exe -m pytest -q tests/test_workflows.py -k reset
```

### Production-mode fixture setup

Use an approved loopback-only SMTP fixture that supports STARTTLS, stores messages locally, and can simulate failed STARTTLS or delivery. Obtain its local listening port and trust certificate from the fixture owner. If it uses a private CA, the backend Python runtime must trust the CA, and the server certificate must match the loopback address. Apply the fixture’s approved trust configuration and keep certificate verification enabled. Supply fixture-specific settings only. A receiving server with plain SMTP alone is insufficient.

Stop the development backend with Ctrl+C. In a fresh shell at the clone root, apply process-only overrides to the same disposable database. Type the actual port when prompted. Leave the fixture in successful delivery mode initially.

```powershell
Set-Location backend
$env:ENVIRONMENT = 'production'
$env:DEV_RESET_LINKS = 'false'
$env:SMTP_HOST = '127.0.0.1'
$env:SMTP_PORT = Read-Host 'Enter the approved local STARTTLS SMTP fixture port'
if ($env:SMTP_PORT -notmatch '^\d+$' -or [int]$env:SMTP_PORT -lt 1 -or [int]$env:SMTP_PORT -gt 65535) { throw 'Enter a valid local port.' }
Test-NetConnection 127.0.0.1 -Port ([int]$env:SMTP_PORT)
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

Check `/api/health` again and validate the fixture is capturing messages locally. Use browser **Forgot password** or Swagger `POST /api/auth/forgot-password` for functional checks. Prepare an active synthetic account, a separate inactive synthetic account using **Manage Users → Deactivate**, and two unused synthetic addresses. Use a separate tooling run for timing and keep the rate-limit check independent.

### Functional checklist

1. Submit active, unknown, inactive and uppercase variants, staying within the request allowance. Compare HTTP 200, the generic message, JSON content type, cache and security headers. A changing Date header is normal. Verify the response contains no link or address and only the active account receives a local message, including when typed in uppercase.
2. Request two links for the active account. Wait for each delivery before continuing. Open the older link and submit a valid matching password. Expect HTTP 400 and the invalid-or-expired message. Open the newest link and submit a valid matching password. Expect HTTP 200, a successful return to login and working sign-in with the new password. Reuse the newest link and expect HTTP 400. A session created before the password change should receive HTTP 401 on its next authenticated request. Keep links private.
3. Request another link and test it after 30 minutes have elapsed from issuance. Expect HTTP 400 and verify the current password still works. Test a separate invented, correctly shaped invalid token through Swagger and expect HTTP 400. If you cannot wait or cannot obtain the link, mark that independent check Blocked and retain the separate automated result.
4. Put the local SMTP fixture into failure mode and submit an eligible active-account request. Expect the same public 200 body, no captured delivery and a generic backend log such as `Password reset email delivery failed`. Sanitize an excerpt and verify it contains neither an address nor a reset link. Restore success mode and confirm delivery resumes.
5. Use a fresh local backend process and submit five qualifying requests, then a sixth from the same client. Expect the sixth to receive HTTP 429. The safe saturation regression is `test_a01_capacity_is_checked_without_account_lookup`. It sets capacity in a local fixture and checks generic HTTP 503 for both cohorts, no token writes, and successful admission after capacity returns. Use this fixture instead of flooding a service.

### Controlled timing and outcome

If you have the approved fixture, run 40 paired active-versus-unknown samples and 40 paired unknown-versus-unknown control samples against the **local disposable** application. Keep database, SMTP behavior, client, transport and connection reuse consistent, balance the cohort order, and separate samples from concurrent work. Use the fixture’s documented isolated setup and leave application rate limits enabled. Record how it handles independently scoped samples and record any 429, 503 or invalid responses separately from comparable 200 samples.

Record per-cohort medians, median of the *within-pair* differences, sample counts, variability and classification results if the approved fixture already reports them. Record the control using the same summary. The [developer measurements](qa-a01-a04-final-corrections.md#measured-response-times) are reference observations. Compare the direction and size of the difference with the control and the prior reproducible latency gap. A small run does not prove timing equivalence under production load. Mark **Partial** if the reset flow passes but a meaningful difference remains. Mark **Blocked** where the fixture or valid sample data is unavailable. Capture the aggregate table, configuration summary, sanitized status/header comparison and redacted SMTP/log evidence.

Return to development mode before browser regressions by stopping Uvicorn, closing the production shell and starting it from a fresh shell as in Part B.

## D. BUG-A04 — Eight validation cases

Use Edge at 1440 × 900 for the original functional retest. Have a synthetic administrator, a known professional for each edit context, and complete valid contact data ready. Open DevTools → Network → Fetch/XHR. For each row below, start with a fresh valid form, replacing only the named input. For spaces-only cases type three spaces. Save or Create and open the request’s status in Network. Each case should return **422** and display the exact plain message below.

| # | Navigation and action | Test input | Expected feedback | Correct and retry |
|---|---|---|---|---|
| 1 | Admin → Manage Users → Add professional → Create professional | First name = three spaces | First name is required. | Enter a synthetic first name and create. |
| 2 | Admin → Manage Users → Add professional → Create professional | Specialization = three spaces | Specialization is required. | Enter an invented specialty and create. |
| 3 | Admin → Manage Users → Add professional → Create professional | License number = three spaces | License number is required. | Enter a unique invented license and create. |
| 4 | Admin → Manage Users → Add professional → Create professional | Workplace = three spaces | Workplace is required. | Enter an invented workplace and create. |
| 5 | Admin → Manage Users → target professional row → Edit → Save professional | Email address = `qa@example` | Enter a valid email address, such as name@example.com. | Enter a unique valid synthetic email and save. |
| 6 | Admin → Manage Users → target professional row → Edit → Save professional | Specialization = three spaces | Specialization is required. | Enter an invented specialty and save. |
| 7 | Admin → Manage Users → target professional row → Edit → Save professional | License number = three spaces | License number is required. | Enter a unique invented license and save. |
| 8 | Sign in as professional → My Profile → Save changes | Email address = `qa@example` | Enter a valid email address, such as name@example.com. | Enter a unique valid synthetic email and save. Use the new address next time you sign in. |

For **each** case, note the original values or account count first. After the error, check the mistyped input and other entered values remain available. Confirm the account list contains no partial or duplicate creation and that the saved profile has its original values after rejection. Use a separate signed-in administrator window if needed to check storage without discarding the form. Correct only the invalid input, expect HTTP **201** for creation or **200** for edit, and confirm the intended record through the user list or a fresh profile load. Capture the on-screen message and Network status without showing response headers, cookies, passwords or payloads. Mark the case Pass only when all checks agree.

Also check Forgot Password with `qa@example` and the existing password rule on Reset Password, Add patient and Add professional using matching `abcdefghij` entries. Use a local development reset link for the browser reset form. Those weak passwords should be rejected with the plain letter-and-number requirement. Compare with the automated A04 tests in Part F.

## E. UX-01 through UX-11 — Two Edge viewports

For each case use both **1536 × 730** and **1920 × 945** CSS pixels. In Edge at 100% zoom, open DevTools with F12, toggle the Device Toolbar with Ctrl+Shift+M, select **Responsive**, set both dimensions and choose the desktop device type if available. Undock DevTools when needed and keep the page zoom and emulated viewport dimensions recorded. In the DevTools console verify `({ width: innerWidth, height: innerHeight })` before starting. The tracked Playwright UX suite sets both sizes explicitly with Microsoft Edge. Run it separately from manual observation. Reload fresh before each scenario and use separate records or restore reversible statuses for the second viewport.

### UX-01 — Edit form becomes visible

With a low professional and low medication row available, go to **Admin → Manage Users** and **Patient → Dashboard → My Medications** respectively. Scroll until the form area is off-screen, then click the row’s **Edit**. Expect the existing form to come into view immediately and its first input to receive focus. Cancel and repeat with a different low row. Confirm neither record changed after Cancel by reopening both. Capture the lower row before the action and the focused form immediately afterward. Pass if both forms are visible and focused at both sizes with no accidental save.

### UX-02 — Identify the edited record

On those same pages, choose two distinct rows per page. Click **Edit** on the first, compare the heading and values with the selected row, cancel, then repeat with the second. For a valid retry, save one distinguishable synthetic change on the second and reload the list to confirm only that row changed. Capture the row and matching heading/prefill, then the persisted result. Pass if the selection is unambiguous and the save targets the intended record.

### UX-03 — Failed Save feedback stays visible

Open **Patient → My Profile**, **Professional → My Profile**, **Admin → Manage Users → Edit professional**, and **Patient → My Medications → Edit** separately. With each form otherwise valid, type three spaces in patient **First name**, professional **Specialization** on both professional forms, and medication **Dosage**. Click the relevant Save button from the bottom of the form. Expect HTTP 422 and the error by the field in view without manual scrolling. Compare stored values independently before correcting the input, then save and reload. Capture the field and alert immediately after the failure and record Network status. Pass if all four forms retain the unsaved input, preserve storage on rejection and accept the valid retry.

### UX-04 — Understandable validation messages

With valid synthetic records and distinct unused add-form emails, repeat UX-03 and submit spaces-only **First name** from **Manage Users → Add patient** and **Add professional**. Confirm server 422 responses and plain names such as “First name is required,” “Specialization is required,” and “Dosage is required.” Correct each field and save/create. Check the intended record persisted once and rejection created no records. Capture each distinct message and sanitized status. Pass if all six forms show clear correction text and allow the valid retry.

### UX-05 — Invalid indication, keyboard focus and ARIA

Use all six forms from UX-04 and keyboard-tab to Save/Create. Submit the same invalid values using the keyboard. Inspect the first invalid control in Edge Elements. Expect focus, visible invalid styling, `aria-invalid="true"`, and an `aria-describedby` value that resolves to the visible error element. With two whitespace-invalid fields, verify focus moves to the first in form order, and correcting one preserves the other error. Correct both and retry successfully. Reload and compare persisted values with the intended update. Capture the highlighted field and sanitized DOM inspector; record where keyboard focus lands. Pass if each field is identified and appropriately focused after real server rejection. Actual screen-reader behavior remains unverified unless you run a separate screen-reader test and record its product, version and observations.

### UX-06 — Password hint appears where relevant

As admin, open **Manage Users → Edit** for a professional, then **Add patient** and **Add professional** separately. Verify the hint and password fields appear on both creation forms and are absent from the editor. Cancel each and reopen to verify the same result. Check the account list and professional profile are unchanged after Cancel. Capture each form’s action area. Pass if the hint appears only on forms with password fields.

### UX-07 — Failed Create feedback stays visible

As admin, open **Add patient** and **Add professional**. Fill valid synthetic details, enter different values in the password fields and click **Create**. Expect visible mismatch feedback by **Confirm password** and zero creation requests. Match the passwords and enter an already registered email. Expect 409 and immediate visible feedback in both forms. Confirm field values are retained and the account count stays stable. Replace the duplicate email with a unique one, create, and check exactly one new row. Capture the feedback, status and valid retry per form. Pass if both failure paths are understandable and the valid retry persists once.

### UX-08 — Patient duplicate-email wording

With a registered synthetic email, open **Manage Users → Add patient** and submit complete valid details using that address. Expect HTTP 409 and an inline “This email address is already registered.” Use **Add professional** with the same email and a unique license, and verify the professional conflict can mention email or license. Then use unique emails and verify valid creation. Check the counts and that the original account remains unchanged. Capture both errors and status. Pass if wording is appropriate to each form and duplicate rows are absent.

### UX-09 — Confirm before discarding professional edits

As admin, open **Manage Users → Edit** on professional A and edit **Workplace** without saving. Click **Edit** on professional B. Dismiss the confirmation and verify A and the typed value remain. Repeat, accept and verify B opens and A’s stored value stayed intact. Independently repeat both choices with the **Healthcare professionals** filter and the **Assignments** sidebar link. Test Cancel after restoring the exact original value and verify it closes without confirmation. Reload and compare both stored profiles with the original values. Capture the prompt if possible and the retained editor after dismissal. Pass if each action honors both choices and no unsaved value persists.

### UX-10 — Account status preserves position

As admin, go to **Manage Users**, filter to professionals and apply a search broad enough to retain a long list. Scroll to a low active row and click **Deactivate**, then **Activate**. Expect feedback by the row, the updated status in view, and the search and filter to remain selected without returning to the top. Verify the status after reload and confirm neighboring rows are intact. Use the tracked Playwright scenario for simulated 503 feedback and retry. Capture before/after viewport shots with the same row and a visible filter/search if possible. Pass if both actions and the failure fixture preserve context and the correct state.

### UX-11 — Assignment and medication deactivation feedback

As admin, go to **Assignments** and deactivate a low active assignment. As patient, go to **My Medications** and deactivate a lower active medication with recorded history. Expect row-local confirmation and the Inactive badge together, with no stale error. Reload and confirm the assignment end date and retained medication intake history. Use another active assignment or reactivate the medication to repeat. Use the Playwright simulation to check a 503 leaves the original status and supports retry. Capture both action rows with feedback and the retained history. Pass if both workflows show visible confirmation without losing context or history.

## F. Regression commands and earlier fixes

At the clone root:

```powershell
Push-Location backend
.\.venv\Scripts\python.exe -m pytest -q
Pop-Location
Push-Location frontend
npm.cmd test
npm.cmd run build
Pop-Location
```

Keep development-mode FastAPI and Vite running as in Part B. From the root, run the following with your local synthetic administrator. Four batches avoid mixing different fixture requirements. The existing shared local rate limits still apply between batches. Use a fresh disposable backend process between batch runs where needed and a fresh database when rerunning fixed-name fixtures. Keep prior QA evidence separately.

```powershell
$qaAdmin = Get-Credential -Message 'Local synthetic NeuroAdapt administrator'
$env:E2E_ADMIN_EMAIL = $qaAdmin.UserName
$env:E2E_ADMIN_PASSWORD = $qaAdmin.GetNetworkCredential().Password
Push-Location frontend
try {
    npm.cmd run test:e2e -- alaa-qa-bugs.spec.js alaa-remaining.spec.js --trace off --output ../tmp/alaa-independent/prior-fixes
    npm.cmd run test:e2e -- development-fixes.spec.js visual.spec.js workflows.spec.js --trace off --output ../tmp/alaa-independent/workflows
    npm.cmd run test:e2e -- alaa-a04-final.spec.js --trace off --output ../tmp/alaa-independent/a04
    npm.cmd run test:e2e -- alaa-ux-findings.spec.js --trace off --output ../tmp/alaa-independent/ux
} finally {
    Pop-Location
    Remove-Item Env:E2E_ADMIN_EMAIL, Env:E2E_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    Remove-Variable qaAdmin -ErrorAction SilentlyContinue
}
```

Run one command at a time if restarting services between batches. Capture counts, failures and skips. A missing-credentials skip is Blocked. Automated checks supplement independent manual observation.

| Earlier bug | Independent regression |
|---|---|
| A01 | Part C covers public reset privacy and complete token behavior. |
| A02 | In admin professional edit and professional My Profile, try blank Phone and blank or spaces-only Workplace. Verify rejection and unchanged saved values. Correct both and save, including a valid formatted phone. |
| A03 | In Manage Users and Assignments, submit a duplicate creation/assignment, then run a successful row action. Repeat success followed by a failed action using the tracked tests for 503. Verify only the latest result and preserved form inputs. |
| A04 | Part D covers all eight remaining cases and the earlier Forgot Password, Reset Password, and administrator creation messages. |
| A05 | As a professional, verify an assigned patient loads. Change the monitoring route suffix to `abc` and try synthetic unassigned and unknown IDs. Verify the same Access Denied view. |
| A06 | On registration, Add patient and patient My Profile, try a date before 1900-01-01 and a future date. Verify rejection and unchanged storage. Verify 1900-01-01 and today are accepted where tested. The backend regression covers direct API boundaries. |

## G. Record independent QA results

Keep the existing Excel test-case workbook and its Test 1 evidence intact. Add a new retest sheet or new retest columns according to your team’s workbook convention. Test 1 belongs to the original build. Record the new independent observation in a separate field or row and link back to the original case ID. Use one row per scenario and viewport where useful, then roll up to the finding.

If Azure DevOps work items already exist, add a retest note with the build, environment, outcome and sanitized evidence link to each matching bug. Add UX evidence to the separate matching UX work items. If there is no matching work item or access, record the result in the workbook and note that limitation. Only close a bug once you have independently verified its correction across the required scenarios, subject to your team’s QA workflow. Leave Fail, Partial and Blocked items open.

**Pass** means the expected behavior and persisted state were verified. **Fail** means the issue still reproduces or a required assertion fails. **Partial** means some checks succeeded and a gap remains. **Blocked** means a missing prerequisite prevents execution. No developer measurement pre-populates your result.

| ID | Branch / application commit / tested HEAD | Date | Environment / viewport | Steps | Expected | Actual | Outcome | Evidence | Remaining issue |
|---|---|---|---|---|---|---|---|---|---|
| BUG-A01 | | | | | | | | | |
| BUG-A04 | | | | | | | | | |
| UX-01 | | | | | | | | | |
| UX-02 | | | | | | | | | |
| UX-03 | | | | | | | | | |
| UX-04 | | | | | | | | | |
| UX-05 | | | | | | | | | |
| UX-06 | | | | | | | | | |
| UX-07 | | | | | | | | | |
| UX-08 | | | | | | | | | |
| UX-09 | | | | | | | | | |
| UX-10 | | | | | | | | | |
| UX-11 | | | | | | | | | |

## H. If a test fails

1. Capture the viewport and record the exact steps, expected behavior and what you observed before changing anything.
2. Record the branch, application commit, tested HEAD, test date, viewport, role and synthetic fixture. Save minimal sanitized logs and Network statuses. Remove access tokens, reset links, credentials, payloads and private data from evidence.
3. Record Fail or Partial, or Blocked for a missing dependency. Notify the development team with the finding ID and evidence reference.
4. Preserve the application and test assertions for reproduction. Leave the finding open and record what should be rerun after an approved correction.
