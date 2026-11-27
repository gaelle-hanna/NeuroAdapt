import { test, expect } from "../../frontend/node_modules/@playwright/test/index.mjs";

const password = "SyntheticA04Pass123";
const fields = {
  "First name": "Synthetic", "Last name": "Professional",
  Phone: "+15550101234", Specialization: "Synthetic specialty",
  Workplace: "Synthetic workplace",
};
const invalidEmail = "Enter a valid email address, such as name@example.com.";

test.use({ viewport: { width: 1440, height: 900 } });
test.skip(!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD,
  "Requires a disposable administrator.");

async function login(request, email, password) {
  const result = await request.post("/api/auth/login", { data: { email, password } });
  expect(result.status()).toBe(200);
  return { Authorization: `Bearer ${(await result.json()).access_token}` };
}

async function open(page, path, headers) {
  await page.addInitScript((token) => sessionStorage.setItem("neuroadapt-token", token),
    headers.Authorization.slice("Bearer ".length));
  await page.goto(path);
}

function mutation(page, method, path) {
  return page.waitForResponse((response) => response.request().method() === method &&
    new URL(response.url()).pathname === path);
}

async function rejection(page, submit, method, path, label, value, message) {
  const field = page.getByLabel(label, { exact: true });
  const firstName = page.getByLabel("First name", { exact: true });
  const retainedName = await firstName.inputValue();
  const original = await field.inputValue();
  await field.fill(value);
  const response = mutation(page, method, path);
  await submit.click();
  expect((await response).status()).toBe(422);
  await expect(page.getByRole("alert")).toHaveText(message);
  await expect(field).toHaveValue(value);
  if (label !== "First name") await expect(firstName).toHaveValue(retainedName);
  await field.fill(original);
}

test("A04 Add professional rejects each reported spaces-only input", async ({ page, request }) => {
  const admin = await login(request, process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD);
  const path = "/api/admin/professionals";
  const email = `a04-create-${Date.now()}@example.com`;
  const users = async () => (await request.get("/api/admin/users", { headers: admin })).json();
  const count = (await users()).length;
  await open(page, "/admin/users", admin);
  await page.getByRole("button", { name: "+ Add professional", exact: true }).click();
  for (const [label, value] of Object.entries({
    ...fields, "Email address": email, "License number": email,
    "Temporary password": password, "Confirm password": password,
  })) await page.getByLabel(label, { exact: true }).fill(value);
  const submit = page.getByRole("button", { name: "Create professional", exact: true });
  for (const field of ["First name", "Specialization", "License number", "Workplace"]) {
    await test.step(field, async () => {
      await rejection(page, submit, "POST", path, field, "   ", `${field} is required.`);
      expect(await users()).toHaveLength(count);
    });
  }
  const accepted = mutation(page, "POST", path);
  await submit.click();
  expect((await accepted).status()).toBe(201);
  await expect(page.getByText("Healthcare professional saved successfully.")).toBeVisible();
  expect((await users()).filter((user) => user.email === email)).toHaveLength(1);
});

for (const role of ["admin", "professional"]) {
  test(`A04 ${role} professional editor rejects the reported fields`, async ({ page, request }) => {
    const admin = await login(request, process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD);
    const email = `a04-${role}-${Date.now()}@example.com`;
    const created = await request.post("/api/admin/professionals", { headers: admin, data: {
      first_name: fields["First name"], last_name: fields["Last name"], phone: fields.Phone,
      specialization: fields.Specialization, workplace: fields.Workplace,
      license_number: email, email, password, confirm_password: password,
    } });
    expect(created.status()).toBe(201);
    const original = await created.json();
    const headers = role === "admin" ? admin : await login(request, email, password);
    const stored = async () => {
      const response = await request.get("/api/admin/users", { headers: admin });
      return (await response.json()).find(({ id }) => id === original.id);
    };
    const path = role === "admin" ? `/api/admin/professionals/${original.id}` : "/api/profiles/professional";
    await open(page, role === "admin" ? "/admin/users" : "/professional/profile", headers);
    if (role === "admin") {
      await page.getByRole("row").filter({ hasText: email }).getByRole("button", { name: "Edit", exact: true }).click();
    }
    const submit = page.getByRole("button", { name: role === "admin" ? "Save professional" : "Save changes" });
    const cases = [["Email address", "qa@example", invalidEmail]];
    if (role === "admin") {
      cases.push(["Specialization", "   ", "Specialization is required."],
        ["License number", "   ", "License number is required."]);
    }
    for (const [label, value, message] of cases) {
      await test.step(label, async () => {
        await rejection(page, submit, "PUT", path, label, value, message);
        expect(await stored()).toEqual(original);
      });
    }
    await page.getByLabel("First name", { exact: true }).fill("Corrected");
    const accepted = mutation(page, "PUT", path);
    await submit.click();
    expect((await accepted).status()).toBe(200);
    expect((await stored()).first_name).toBe("Corrected");
  });
}
