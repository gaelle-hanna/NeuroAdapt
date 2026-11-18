# MariaDB / XAMPP

Use MariaDB with InnoDB and utf8mb4. The application does not automatically create or replace a database. Start **MySQL** in the XAMPP Control Panel (XAMPP distributes MariaDB under this label).

In phpMyAdmin's SQL tab, create a database and an application user; replace the sample password before running:

```sql
CREATE DATABASE neuroadapt CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'neuroadapt'@'localhost' IDENTIFIED BY 'choose-a-local-password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP ON neuroadapt.* TO 'neuroadapt'@'localhost';
```

Use a separate migration account for deployed environments and restrict runtime privileges to SELECT, INSERT, UPDATE, DELETE. URL-encode special characters in connection credentials.

From `backend`, configure `.env`, then run `.venv\Scripts\python.exe -m alembic upgrade head`. This is the recommended setup and records revision `0001`. It creates the seven domain tables plus Alembic's version table.

Alternatively, select an **empty** `neuroadapt` database in phpMyAdmin and import `database/schema.sql`. This is the offline SQL emitted by the initial Alembic migration, including its version stamp. Do not import it after applying the migration.

IDs and columns match the final ERD. Foreign keys use RESTRICT for clinical/tracking records and CASCADE for reset tokens. Profiles share their primary keys with USERS. Account/profile role consistency and duplicate active assignments are transactionally enforced by application services; do not bypass those services with manual inserts.

## Backups

Use XAMPP's `mysqldump.exe` or phpMyAdmin Export with all tables, structure and data. For example:

```powershell
C:\xampp\mysql\bin\mysqldump.exe -u neuroadapt -p --single-transaction --result-file=neuroadapt-backup.sql neuroadapt
```

Enter the password at the prompt. Store backups outside Git, restrict access, and test restoration into a separate database. Do not place real patient data in this academic prototype. Migration downgrade drops tables and is destructive; use only on disposable databases with backups.
