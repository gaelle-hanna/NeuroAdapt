import { test, expect } from "../../frontend/node_modules/@playwright/test/index.mjs";

for (const route of ["/register", "/patient/profile", "/admin/users"]) {
  test(`A06 date boundary blocks submission at ${route}`, async ({ page, request }) => {
    if (route === "/patient/profile") {
      const email = "birth-browser@example.com";
      const password = "SyntheticBirth123";
      const reply = await request.post("/api/auth/register", { data: {
        first_name: "Synthetic", last_name: "Birth", email, password,
        confirm_password: password, date_of_birth: "1980-01-01",
        phone: "+15550101234", address: "Synthetic address",
      } });
      expect(reply.status()).toBe(201);
      await login(page, email, password);
    }
    if (route === "/admin/users") {
      await loginAdmin(page);
    }
    await page.goto(route);
    if (route === "/admin/users") await page.getByRole("button", { name: "+ Add patient" }).click();
    const date = page.getByLabel("Date of birth");
    await expect(date).toHaveAttribute("min", "1900-01-01");
    const today = await page.evaluate(() => {
      const now = new Date();
      return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")].join("-");
    });
    await expect(date).toHaveAttribute("max", today);
    await date.fill("1899-12-31");
    expect(await date.evaluate((field) => field.validity.rangeUnderflow)).toBe(true);
    expect(await date.evaluate((field) => field.validationMessage.length > 0)).toBe(true);
    expect(await date.evaluate((field) => {
      let invalid = false;
      field.addEventListener("invalid", () => { invalid = true; }, { once: true });
      field.form.requestSubmit();
      return invalid;
    })).toBe(true);
    await date.fill("1900-01-01");
    expect(await date.evaluate((field) => field.checkValidity())).toBe(true);
    await date.fill(today);
    expect(await date.evaluate((field) => field.checkValidity())).toBe(true);
  });
}

async function login(page, email, password) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/(admin|patient|professional)$/);
}

async function loginAdmin(page) {
  const { E2E_ADMIN_EMAIL: email, E2E_ADMIN_PASSWORD: password } = process.env;
  test.skip(!email || !password, "Requires a disposable administrator.");
  await login(page, email, password);
}

test("A02 administrator and professional editors require contact fields", async ({ page, request }) => {
  await loginAdmin(page);
  const admin = await request.post("/api/auth/login", { data: {
    email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD,
  } });
  expect(admin.status()).toBe(200);
  const email = "contact-browser@example.com", password = "SyntheticContact123";
  const created = await request.post("/api/admin/professionals", {
    headers: { Authorization: `Bearer ${(await admin.json()).access_token}` },
    data: { email, password, confirm_password: password, first_name: "Synthetic", last_name: "Contact",
      phone: "+15550101234", workplace: "Synthetic clinic", specialization: "QA", license_number: "CONTACT-BROWSER" },
  });
  expect(created.status()).toBe(201);
  await page.goto("/admin/users");
  await page.getByRole("row").filter({ hasText: email }).getByRole("button", { name: "Edit" }).click();
  await exerciseEditor(page, "Save professional", "Healthcare professional saved successfully.");
  await page.getByRole("button", { name: "Log out" }).click();
  await login(page, email, password);
  await page.goto("/professional/profile");
  await exerciseEditor(page, "Save changes", "Your profile was updated successfully.");
});

async function exerciseEditor(page, saveLabel, success) {
  const phone = page.getByLabel("Phone", { exact: true });
  const workplace = page.getByLabel("Workplace", { exact: true });
  const save = page.getByRole("button", { name: saveLabel, exact: true });
  await expect(phone).toHaveAttribute("required", "");
  await expect(workplace).toHaveAttribute("required", "");
  const submissions = [];
  const record = (request) => {
    if (request.method() === "PUT" && /\/api\/(admin\/professionals\/\d+|profiles\/professional)$/.test(new URL(request.url()).pathname))
      submissions.push(request);
  };
  page.on("request", record);
  await workplace.fill("   ");
  expect(await workplace.evaluate((field) => field.validity.patternMismatch)).toBe(true);
  await save.click();
  await expect(workplace).toBeFocused();
  await expect(workplace).toHaveValue("   ");
  await workplace.fill("Synthetic updated workplace");
  await phone.fill("");
  await save.click();
  await expect(phone).toBeFocused();
  expect(submissions).toHaveLength(0);
  await phone.fill("+1 (555) 010-1234");
  await save.click();
  await expect(page.getByText(success)).toBeVisible();
  expect(submissions).toHaveLength(1);
  page.off("request", record);
}
