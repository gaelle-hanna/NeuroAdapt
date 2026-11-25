import { test, expect } from "../../frontend/node_modules/@playwright/test/index.mjs";

const password = "SyntheticAlaaQA123";
const patient = {
  first_name: "Synthetic", last_name: "AlaaPatient", password,
  confirm_password: password, phone: "+15550101234", date_of_birth: "1980-01-01",
  address: "Synthetic QA address",
};

async function fill(page, values) {
  for (const [label, value] of Object.entries(values)) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
}

async function adminSetup(page, request) {
  const email = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !adminPassword, "Requires a disposable administrator.");
  const login = await request.post("/api/auth/login", { data: { email, password: adminPassword } });
  expect(login.status()).toBe(200);
  await page.goto("/login");
  await fill(page, { "Email address": email, Password: adminPassword });
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  return { Authorization: `Bearer ${(await login.json()).access_token}` };
}

async function seed(request, headers, suffix) {
  const email = `alaa-patient-${suffix}@example.com`;
  const p = await request.post("/api/admin/patients", { headers, data: { ...patient, email } });
  expect(p.status()).toBe(201);
  const providerEmail = `alaa-provider-${suffix}@example.com`;
  const pro = await request.post("/api/admin/professionals", { headers, data: {
    email: providerEmail, first_name: "Synthetic", last_name: "AlaaProvider",
    password, confirm_password: password, phone: patient.phone,
    specialization: "QA", license_number: `ALAA-${suffix}`, workplace: "Synthetic clinic",
  } });
  expect(pro.status()).toBe(201);
  return { email, providerEmail, patientId: (await p.json()).id, providerId: (await pro.json()).id };
}

test("A03 Manage Users swaps form errors and row success in both directions", async ({ page, request }) => {
  const headers = await adminSetup(page, request);
  const { email } = await seed(request, headers, Date.now());
  await page.goto("/admin/users");
  const row = page.getByRole("row").filter({ hasText: email });
  const status = page.getByText("Account status updated successfully.");
  await row.getByRole("button", { name: "Deactivate", exact: true }).click();
  await expect(status).toBeVisible();
  await page.getByRole("button", { name: /add patient/i }).click();
  await fill(page, { "First name": patient.first_name, "Last name": patient.last_name,
    "Email address": email, Phone: patient.phone, "Date of birth": patient.date_of_birth,
    Address: patient.address, "Temporary password": password, "Confirm password": password });
  await page.getByRole("button", { name: "Create patient", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/already/i);
  await expect(status).toHaveCount(0);
  await row.getByRole("button", { name: "Activate", exact: true }).click();
  await expect(status).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(email);
});

test("A03 Assignments swaps duplicate error and deactivation success", async ({ page, request }) => {
  const headers = await adminSetup(page, request);
  const { patientId, providerId } = await seed(request, headers, Date.now());
  await page.goto("/admin/assignments");
  await page.getByLabel("Select patient", { exact: true }).selectOption(String(patientId));
  await page.getByLabel("Select healthcare professional").selectOption(String(providerId));
  const save = page.getByRole("button", { name: "Save assignment" });
  await save.click();
  await expect(page.getByText("Assignment saved successfully.")).toBeVisible();
  await save.click();
  await expect(page.getByRole("alert")).toContainText("active assignment already exists");
  await expect(page.getByText("Assignment saved successfully.")).toHaveCount(0);
  await page.getByRole("row").filter({ hasText: "Synthetic AlaaPatient" })
    .getByRole("button", { name: "Deactivate assignment" }).click();
  await expect(page.getByText("Assignment deactivated. Historical records retained.")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("A04 forgot shows friendly real validation response", async ({ page }) => {
  await page.goto("/forgot-password");
  await fill(page, { "Email address": "qa@example" });
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("alert")).toHaveText("Enter a valid email address, such as name@example.com.");
});

test("A04 reset shows the password rule without technical prefixes", async ({ page, request }) => {
  const email = `alaa-reset-${Date.now()}@example.com`;
  expect((await request.post("/api/auth/register", { data: { ...patient, email } })).status()).toBe(201);
  const reply = await request.post("/api/auth/forgot-password", { data: { email } });
  expect(reply.status()).toBe(200);
  const link = (await reply.json()).development_reset_link;
  expect(Boolean(link)).toBe(true);
  const reset = new URL(link);
  await page.goto(reset.pathname + reset.hash);
  await fill(page, { "New password": "abcdefghij", "Confirm password": "abcdefghij" });
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("alert")).toHaveText("Use at least 10 characters including a letter and a number");
});

test("A04 admin creation shows the password rule without technical prefixes", async ({ page, request }) => {
  await adminSetup(page, request);
  await page.goto("/admin/users");
  for (const role of ["patient", "professional"]) {
    await page.getByRole("button", { name: new RegExp(`add ${role}`, "i") }).click();
    const details = role === "patient" ? { "Date of birth": patient.date_of_birth, Address: patient.address }
      : { Specialization: "QA", "License number": "ALAA-A04", Workplace: "Synthetic" };
    await fill(page, { "First name": "Synthetic", "Last name": "Account", "Email address": `alaa-a04-${role}@example.com`,
      Phone: patient.phone, "Temporary password": "abcdefghij", "Confirm password": "abcdefghij", ...details });
    await page.getByRole("button", { name: `Create ${role}`, exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText("Use at least 10 characters including a letter and a number");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
  }
});

test("A05 malformed, unknown and unassigned patient IDs show Access denied", async ({ page, request }) => {
  const headers = await adminSetup(page, request);
  const { providerEmail, patientId } = await seed(request, headers, Date.now());
  await page.getByRole("button", { name: "Log out" }).click();
  await fill(page, { "Email address": providerEmail, Password: password });
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/professional$/);
  const malformedRequests = [];
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/api/monitoring/patients/abc") malformedRequests.push(req);
  });
  for (const id of ["abc", "999999", patientId]) {
    await page.goto(`/professional/patients/${id}`);
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
  }
  expect(malformedRequests).toHaveLength(0);
});
