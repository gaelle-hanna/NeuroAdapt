# NeuroAdapt

Academic medication tracking and authorized patient monitoring platform. React JavaScript/Vite frontend, FastAPI/SQLAlchemy backend, MariaDB database. Built from the existing documentation and 18 UI references; original documents are preserved. This is an academic prototype, not a clinically validated application.

## Structure

```text
frontend/src/       React pages, reusable controls, authentication, API client, CSS
backend/app/        models, schemas, routers, services, core security/configuration
backend/alembic/    initial seven-table migration
backend/tests/     API workflow/security regression tests
database/          MariaDB SQL export and database/backup instructions
tests/e2e/         Playwright scenarios against the running application
scripts/           Windows backend setup helper
docs/              original references, scope decisions, verification report
```

## Windows PowerShell setup

Install Git, Python 3.10+, Node.js 22.12+, and Docker Desktop with its Linux containers engine running. The browser tests also use Microsoft Edge. Run these commands in PowerShell.

### Clone and install backend dependencies

Use the private GitHub repository URL shared by the project owner. Accept the repository invitation and sign in with your own GitHub account first. Replace `OWNER` with the repository owner.

~~~powershell
git clone https://github.com/OWNER/NeuroAdapt.git
Set-Location NeuroAdapt
python -m venv backend\.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
~~~

### Configure and start MariaDB

Run this once from the project root to create a local QA database and its matching `backend/.env`. Port 3306 must be available. If you already have an environment file or QA container, preserve them and reuse the configuration you created for that container.

~~~powershell
if (Test-Path backend\.env) { throw 'backend\.env already exists. Reuse or review it before setup.' }

$python = '.\backend\.venv\Scripts\python.exe'
$dbPassword = & $python -c "import secrets; print(secrets.token_hex(24))"
$jwtSecret = & $python -c "import secrets; print(secrets.token_urlsafe(48))"
if (-not $dbPassword -or -not $jwtSecret) { throw 'Secret generation failed.' }

$env:MARIADB_PASSWORD = $dbPassword
$env:MARIADB_RANDOM_ROOT_PASSWORD = '1'
try {
    docker run --detach --name neuroadapt-qa-db --publish 127.0.0.1:3306:3306 --env MARIADB_DATABASE=neuroadapt --env MARIADB_USER=neuroadapt --env MARIADB_PASSWORD --env MARIADB_RANDOM_ROOT_PASSWORD --health-cmd "healthcheck.sh --connect --innodb_initialized" --health-interval 5s --health-timeout 5s --health-retries 12 mariadb:11.4
    if ($LASTEXITCODE -ne 0) { throw 'MariaDB container creation failed.' }

    $config = (Get-Content -Raw backend\.env.example).Replace('CHANGE_ME', $dbPassword).Replace('REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS', $jwtSecret)
    Set-Content -Path backend\.env -Value $config -Encoding UTF8
} finally {
    Remove-Item Env:MARIADB_PASSWORD, Env:MARIADB_RANDOM_ROOT_PASSWORD -ErrorAction SilentlyContinue
    Remove-Variable dbPassword, jwtSecret, config -ErrorAction SilentlyContinue
}

docker inspect --format '{{.State.Health.Status}}' neuroadapt-qa-db
~~~

Repeat the final inspection command until it shows `healthy`. Keep `backend/.env` local. Set `DEV_RESET_LINKS=true` there only if you need the development reset flow or browser tests. Leave SMTP fields blank for that mode. For future sessions, start the same database with `docker start neuroadapt-qa-db` and check its health again.

### Migrate and start the backend

In a terminal at the project root:

~~~powershell
Set-Location backend
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --no-access-log
~~~

### Install and start the frontend

In a second terminal at the project root:

~~~powershell
Set-Location frontend
npm.cmd ci
npm.cmd run dev
~~~

Open [NeuroAdapt](http://127.0.0.1:5173). [Swagger](http://127.0.0.1:8000/docs) and the [health endpoint](http://127.0.0.1:8000/api/health) are served by FastAPI. Vite forwards `/api` requests to the backend.

### Create synthetic QA accounts

Open another terminal from the project root and create an administrator after migrations have completed:

~~~powershell
Set-Location backend
.\.venv\Scripts\python.exe -m app.cli create-admin
~~~

Use a fictitious email such as `qa-admin@example.com` and choose a unique local password at the hidden prompt. From the app, register a synthetic patient or use the administrator's Manage Users page to add synthetic patients and healthcare professionals. Use made-up names, contact details, birth dates, license numbers, and medication data. To create a ready-made synthetic patient, professional, medication, intake, and assignment in the local development database, run `.\.venv\Scripts\python.exe -m app.cli seed-demo` from `backend` and choose a test password at the prompt.


## Features

- Patient registration, role-directed login, logout, protected pages, and password reset. Patient creation requires date of birth, phone, and address; professional creation requires specialization, license number, phone, and workplace.
- Patient and professional profiles with validated account-bound updates.
- Patient medication creation, editing, activation/deactivation, intake recording, and recent-first history.
- Professional dashboard, searchable assigned patients, profile/medication/history monitoring, and denied-access state.
- Administrator dashboard, searchable/filterable users, professional creation/editing, account status controls, active/historical assignments, and assignment deactivation.
- Responsive matching blue/white interface with API-derived values, loading, success, validation, error, and empty states.

## API

All routes are under `/api`. Authentication uses JSON requests and Bearer JWTs. Authorize Swagger using a token from login. OpenAPI is available at `/openapi.json`.

| Group | Endpoints |
|---|---|
| Authentication | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/forgot-password`, `POST /auth/reset-password` |
| Profiles | `GET /profiles/me`, `PUT /profiles/patient`, `PUT /profiles/professional` |
| Medication | `GET/POST /medications`, `PUT /medications/{id}`, `POST /medications/intakes`, `GET /medications/intakes/history` |
| Monitoring | `GET /monitoring/patients`, `GET /monitoring/patients/{id}`, `GET /monitoring/patients/{id}/history` |
| Administration | `GET /admin/users`, `POST /admin/patients`, `POST /admin/professionals`, `PUT /admin/professionals/{id}`, `PATCH /admin/users/{id}/status`, `GET/POST /admin/assignments`, `DELETE /admin/assignments/{id}` |
| Health | `GET /health` |

Successful creation uses 201; validation uses 422; missing/invalid sessions 401; role/assignment denial 403; missing owned medication 404; duplicates 409; unavailable database 503. Validation and database errors omit raw passwords, tokens, SQL, and database credentials. FastAPI Swagger supplies request schemas and interactive requests.

## Tests

Run from the project root:

~~~powershell
Push-Location backend
.\.venv\Scripts\python.exe -m pytest -q
Pop-Location

Push-Location frontend
npm.cmd test
npm.cmd run build
Pop-Location
~~~

Backend tests use disposable SQLite fixtures and do not exercise MariaDB locking. To run all browser workflows, keep the local frontend and backend running against the synthetic QA database, enable `DEV_RESET_LINKS=true` with SMTP unset, then restart the backend if you changed the environment file. In a new terminal from the root:

```powershell
$qaAdmin = Get-Credential -Message 'Enter the local synthetic NeuroAdapt administrator credentials'
$env:E2E_ADMIN_EMAIL = $qaAdmin.UserName
$env:E2E_ADMIN_PASSWORD = $qaAdmin.GetNetworkCredential().Password
Push-Location frontend
try {
    npm.cmd run test:e2e -- --trace off
} finally {
    Pop-Location
    Remove-Item Env:E2E_ADMIN_EMAIL, Env:E2E_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    Remove-Variable qaAdmin
}
```

Browser tests create synthetic records in the configured database and write screenshots to ignored local folders. Use a disposable QA database for these runs.


## Configuration and security

Backend environment settings are documented in `backend/.env.example`. `ENVIRONMENT` defaults to `development`. `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `SMTP_FROM` configure STARTTLS email. Production requires SMTP and rejects development reset links. SMTP delivery failures return the same generic public response and log only a non-sensitive operational message; configure email monitoring before deployment.

Passwords use Argon2. Reset tokens are hashed, expiring, single-use, and invalidate earlier reset tokens and JWTs after a password change. Resource ownership, active account status, role, and active professional assignments are enforced server-side. JWTs live in browser session storage and expire after 30 minutes. Logout clears that browser's token; copied tokens retain their remaining lifetime. Known local CORS origins are configured explicitly.

For deployment, serve the frontend and API behind HTTPS on the same site, set `ENVIRONMENT=production`, use a managed secret, restrict CORS, use a least-privilege database user, secure backups, and add shared rate limiting before using multiple workers. Do not log reset links or patient payloads. No hardware, AI, games, motor analytics, clinical prescribing, or recommendations are implemented.

Dependencies are pinned in `backend/requirements.txt` and `frontend/package.json`; the npm lockfile records the installed tree when dependency installation succeeds. Reference guidance: [FastAPI JWT security](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/), [SQLAlchemy ORM selection](https://docs.sqlalchemy.org/en/20/orm/queryguide/select.html), [Vite guide](https://vite.dev/guide/).

See the [implementation scope](docs/implementation-scope.md), [verification report](docs/verification.md), [acceptance criteria audit](docs/acceptance-criteria-audit.md), and [development fixes](docs/development-fixes.md).
