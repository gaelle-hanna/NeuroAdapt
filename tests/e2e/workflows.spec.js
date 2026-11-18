import {
  test,
  expect,
} from "../../frontend/node_modules/@playwright/test/index.mjs";

// Runs against the actual local frontend, backend, and migrated MariaDB.
// Supply E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for administrator scenarios.
const password = "E2ePatientPass123";
const email = `e2e-${Date.now()}@example.com`;
test("patient registration, profile, medication, history and password reset", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("First name").fill("Fictitious");
  await page.getByLabel("Last name").fill("Tester");
  await page.getByLabel("Date of birth").fill("1970-01-01");
  await page.getByLabel("Phone").fill("+961 70123456");
  await page.getByLabel("Address", { exact: true }).fill("Fictitious address");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByText("Account created successfully. Please log in."),
  ).toBeVisible();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome, Fictitious" }),
  ).toBeVisible();
  await page.screenshot({
    path: "../tmp/visual/patient-dashboard.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "My Profile", exact: true }).click();
  await page.getByLabel("Phone").fill("+961 123456");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("Your profile was updated successfully."),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Phone")).toHaveValue("+961 123456");
  await page.goto("/patient/medications");
  await page.getByLabel("Medication name").fill("Fictitious medication");
  await page.getByLabel("Dosage").fill("Demo dosage");
  await page.getByLabel("Frequency").fill("Demo frequency");
  await page
    .getByRole("button", { name: "Add medication", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Fictitious medication" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Record Medication", exact: true })
    .click();
  await page
    .getByLabel("Medication", { exact: true })
    .selectOption({ label: "Fictitious medication Demo dosage" });
  const yesterday = new Date(Date.now() - 86400000);
  await page
    .getByLabel("Date", { exact: true })
    .fill(yesterday.toISOString().slice(0, 10));
  await page.getByLabel("Time taken").fill("08:00");
  await page.getByRole("button", { name: "Save medication record" }).click();
  await expect(
    page.getByText("Medication intake saved successfully."),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Medication History", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Fictitious medication Demo dosage" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  const reset = page.getByRole("link", {
    name: "Open local password reset link",
  });
  await expect(reset).toBeVisible();
  await reset.click();
  await page
    .getByLabel("New password", { exact: true })
    .fill("ChangedPatient123");
  await page.getByLabel("Confirm password").fill("ChangedPatient123");
  await page.getByRole("button", { name: "Update password" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("ChangedPatient123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome, Fictitious" }),
  ).toBeVisible();
});

test("administrator assignment and professional authorized and denied monitoring", async ({
  page,
  request,
}) => {
  test.skip(
    !process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD,
    "Requires a securely bootstrapped administrator.",
  );
  const suffix = Date.now(),
    patientEmail = `assigned-${suffix}@example.com`,
    proEmail = `pro-${suffix}@example.com`;
  const p = await request.post("/api/auth/register", {
    data: {
      email: patientEmail,
      first_name: "Assigned",
      phone: "+961 70123456",
      date_of_birth: "1970-01-01",
      address: "Fictitious address",
      last_name: "Demo",
      password,
      confirm_password: password,
    },
  });
  expect(p.status()).toBe(201);
  const patient = await p.json();
  const patientLogin = await request.post("/api/auth/login", {
    data: { email: patientEmail, password },
  });
  const patientHeaders = {
    Authorization: `Bearer ${(await patientLogin.json()).access_token}`,
  };
  const medication = await request.post("/api/medications", {
    headers: patientHeaders,
    data: {
      medication_name: "Fictitious monitoring medication",
      dosage: "Demo dosage",
      frequency: "Demo frequency",
    },
  });
  expect(medication.status()).toBe(201);
  const intake = await request.post("/api/medications/intakes", {
    headers: patientHeaders,
    data: {
      medication_id: (await medication.json()).id,
      taken_at: new Date(Date.now() - 86400000).toISOString(),
      notes: "Fictitious monitoring test",
    },
  });
  expect(intake.status()).toBe(201);
  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.E2E_ADMIN_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("link", { name: "Manage Users", exact: true }).click();
  await page.getByRole("button", { name: "+ Add professional" }).click();
  await page.getByLabel("First name").fill("Professional");
  await page.getByLabel("Last name").fill("Demo");
  await page.getByLabel("Email address").fill(proEmail);
  await page.getByLabel("Phone").fill("+961 70123456");
  await page.getByLabel("Workplace").fill("Fictitious clinic");
  await page.getByLabel("Specialization").fill("Neurology");
  await page.getByLabel("License number").fill(`TEST-${suffix}`);
  await page.getByLabel("Temporary password").fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page
    .getByRole("button", { name: "Create professional", exact: true })
    .click();
  await expect(
    page.getByText("Healthcare professional saved successfully."),
  ).toBeVisible();
  await page.screenshot({
    path: "../tmp/visual/admin-users.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Assignments", exact: true }).click();
  await page
    .getByLabel("Select patient", { exact: true })
    .selectOption(String(patient.id));
  await page
    .getByLabel("Select healthcare professional")
    .selectOption({ label: `Professional Demo — ${proEmail}` });
  await page.getByRole("button", { name: "Save assignment" }).click();
  await expect(page.getByText("Assignment saved successfully.")).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByLabel("Email address").fill(proEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("link", { name: "Open profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Patient monitoring: Assigned Demo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", {
      name: "Fictitious monitoring medication Demo dosage",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "../tmp/visual/patient-monitoring.png",
    fullPage: true,
  });
  await page.goto("/professional/patients/2147483647");
  await expect(
    page.getByRole("heading", { name: "Access denied" }),
  ).toBeVisible();
});
