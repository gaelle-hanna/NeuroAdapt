import { test, expect } from "../../frontend/node_modules/@playwright/test/index.mjs";

const syntheticPassword = "SyntheticAudit123";
const formattedPhone = "+123 (456) 789-012-345";
const patientDetails = {
  first_name: "Audit",
  last_name: "Patient",
  password: syntheticPassword,
  confirm_password: syntheticPassword,
  phone: formattedPhone,
  date_of_birth: "1980-01-01",
  address: "Synthetic address",
};

async function login(page, email, password, role) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(new RegExp("/" + role + "$"));
}

test("patient phone, dashboard, medication feedback and intake validation regressions", async ({
  page,
  request,
}) => {
  const email = `fixes-patient-${Date.now()}@example.com`;
  expect((await request.post("/api/auth/register", { data: { ...patientDetails, email } })).status()).toBe(201);
  await page.goto("/register");
  for (const [label, value] of [
    ["First name", patientDetails.first_name],
    ["Last name", patientDetails.last_name],
    ["Email address", email],
    ["Password", syntheticPassword],
    ["Confirm password", syntheticPassword],
    ["Date of birth", patientDetails.date_of_birth],
    ["Phone", formattedPhone],
    ["Address", patientDetails.address],
  ]) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toContainText(/already exists|already registered/i);
  await expect(page).toHaveURL(/\/register$/);

  await login(page, email, syntheticPassword, "patient");
  await page.getByRole("link", { name: "My Profile", exact: true }).click();
  const phone = page.getByLabel("Phone", { exact: true });
  await expect(phone).toHaveValue("+123456789012345");
  await phone.fill("()+-");
  expect(await phone.evaluate((input) => input.validity.patternMismatch)).toBe(true);
  await phone.fill(formattedPhone);
  expect(await phone.evaluate((input) => input.checkValidity())).toBe(true);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Your profile was updated successfully.")).toBeVisible();
  await page.reload();
  await expect(phone).toHaveValue("+123456789012345");

  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.getByText("Medications saved: 0")).toBeVisible();
  await page.getByRole("link", { name: "My Medications", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No medications" })).toBeVisible();
  const name = page.getByLabel("Medication name");
  const add = page.getByRole("button", { name: "Add medication", exact: true });
  await add.click();
  expect(await name.evaluate((input) => input.validity.valueMissing)).toBe(true);
  await expect(page.getByRole("heading", { name: "No medications" })).toBeVisible();
  await name.fill("Synthetic medication");
  await page.getByLabel("Dosage").fill("Synthetic dosage");
  await page.getByLabel("Frequency").fill("Daily");
  await add.click();
  await expect(page.getByRole("cell", { name: "Synthetic medication", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.getByText("Medications saved: 1")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No medication history" })).toBeVisible();
  await page.getByRole("link", { name: "My Medications", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Frequency").fill("Weekly");
  await page.getByRole("button", { name: "Save medication", exact: true }).click();
  await expect(page.getByText("Medication saved successfully.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Weekly", exact: true })).toBeVisible();

  await page.route("**/api/medications/*", (route) =>
    route.fulfill({ status: 503, json: { detail: "Synthetic medication failure" } }),
  );
  await page.getByRole("button", { name: "Deactivate", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Synthetic medication failure");
  await expect(page.getByText("Medication saved successfully.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Deactivate", exact: true })).toBeVisible();
  await page.unroute("**/api/medications/*");

  await page.getByRole("link", { name: "Record Medication", exact: true }).click();
  const saveIntake = page.getByRole("button", { name: "Save medication record" });
  let intakeRequests = 0;
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname === "/api/medications/intakes") {
      intakeRequests++;
    }
  });
  await saveIntake.click();
  await expect(page.getByRole("alert")).toHaveText(
    "Please select a medication and enter a valid intake date and time.",
  );
  await expect(page.getByLabel("Medication", { exact: true })).toBeFocused();
  expect(intakeRequests).toBe(0);
  await page.getByLabel("Medication", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Date", { exact: true }).fill("2025-01-01");
  await page.getByLabel("Time taken").fill("08:00");
  await saveIntake.click();
  await expect(page.getByText("Medication intake saved successfully.")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(intakeRequests).toBe(1);
});

test("admin mutation feedback and assigned patient's empty monitoring history", async ({
  page,
  request,
}) => {
  const { E2E_ADMIN_EMAIL: adminEmail, E2E_ADMIN_PASSWORD: adminPassword } = process.env;
  test.skip(!adminEmail || !adminPassword, "Requires disposable administrator credentials.");
  const suffix = Date.now();
  const patientEmail = `fixes-assigned-${suffix}@example.com`;
  const professionalEmail = `fixes-provider-${suffix}@example.com`;
  const patient = await request.post("/api/auth/register", {
    data: { ...patientDetails, email: patientEmail, last_name: "EmptyHistory" },
  });
  expect(patient.status()).toBe(201);
  const { id: patientId } = await patient.json();
  const admin = await request.post("/api/auth/login", {
    data: { email: adminEmail, password: adminPassword },
  });
  expect(admin.status()).toBe(200);
  const professional = await request.post("/api/admin/professionals", {
    headers: { Authorization: `Bearer ${(await admin.json()).access_token}` },
    data: {
      email: professionalEmail,
      password: syntheticPassword,
      confirm_password: syntheticPassword,
      first_name: "Audit",
      last_name: "Professional",
      phone: formattedPhone,
      specialization: "Synthetic",
      license_number: `AUDIT-${suffix}`,
      workplace: "Synthetic workplace",
    },
  });
  expect(professional.status()).toBe(201);
  const { id: professionalId } = await professional.json();

  await login(page, adminEmail, adminPassword, "admin");
  await page.getByRole("link", { name: "Manage Users", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: professionalEmail });
  await row.getByRole("button", { name: "Deactivate" }).click();
  await expect(page.getByText("Account status updated successfully.")).toBeVisible();
  await row.getByRole("button", { name: "Activate", exact: true }).click();
  await expect(row.getByRole("button", { name: "Deactivate" })).toBeVisible();
  await page.route(`**/api/admin/users/${professionalId}/status`, (route) =>
    route.fulfill({ status: 503, json: { detail: "Synthetic status failure" } }),
  );
  await row.getByRole("button", { name: "Deactivate" }).click();
  await expect(page.getByRole("alert")).toHaveText("Synthetic status failure");
  await expect(page.getByText("Account status updated successfully.")).toHaveCount(0);

  await page.getByRole("link", { name: "Assignments", exact: true }).click();
  await page.getByLabel("Select patient", { exact: true }).selectOption(String(patientId));
  await page.getByLabel("Select healthcare professional").selectOption(String(professionalId));
  const save = page.getByRole("button", { name: "Save assignment" });
  await save.click();
  await expect(page.getByText("Assignment saved successfully.")).toBeVisible();
  const assignment = page.getByRole("row").filter({ hasText: "Audit EmptyHistory" });
  await expect(assignment).toContainText("Assigned");
  await page.route("**/api/admin/assignments/*", (route) =>
    route.fulfill({ status: 503, json: { detail: "Synthetic assignment failure" } }),
  );
  await assignment.getByRole("button", { name: "Deactivate assignment" }).click();
  await expect(page.getByRole("alert")).toHaveText("Synthetic assignment failure");
  await expect(page.getByText("Assignment saved successfully.")).toHaveCount(0);
  await page.unroute("**/api/admin/assignments/*");
  await save.click();
  await expect(page.getByRole("alert")).toContainText("active assignment already exists");
  await expect(page.getByText("Assignment saved successfully.")).toHaveCount(0);

  await page.getByRole("button", { name: "Log out" }).click();
  await login(page, professionalEmail, syntheticPassword, "professional");
  await page.getByRole("row").filter({ hasText: "Audit EmptyHistory" })
    .getByRole("link", { name: "Open profile" }).click();
  await expect(page.getByRole("heading", { name: "Patient monitoring: Audit EmptyHistory" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Patient profile" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No medication history" })).toBeVisible();
});
