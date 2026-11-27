import { test, expect } from "../../frontend/node_modules/@playwright/test/index.mjs";

const password = "SyntheticUxPass123";
const baseline = process.env.E2E_UX_BASELINE === "1";
const profile = { first_name: "Synthetic", phone: "+15550101234" };
const patientDetails = { date_of_birth: "1980-01-01", address: "Synthetic address" };
const professionalDetails = { specialization: "QA", workplace: "Synthetic clinic" };
const credentials = { password, confirm_password: password };
const medication = { dosage: "Synthetic dosage", frequency: "Synthetic frequency" };

async function check(response, status = 200) {
  expect(response.status(), await response.text()).toBe(status);
  return response.json();
}

async function login(request, email, password) {
  const result = await check(await request.post("/api/auth/login", { data: { email, password } }));
  return { Authorization: `Bearer ${result.access_token}` };
}

async function open(page, route, headers) {
  await page.addInitScript((token) => sessionStorage.setItem("neuroadapt-token", token),
    headers.Authorization.slice("Bearer ".length));
  await page.goto(route);
}

async function screenshot(page, info, name) {
  await page.screenshot({ path: info.outputPath(`${name}.png`) });
}

function row(page, text) {
  return page.getByRole("row").filter({ hasText: text });
}

async function fieldError(page, label, message, value) {
  const field = page.getByLabel(label, { exact: true });
  const alert = page.getByRole("alert");
  await expect(alert).toHaveText(message);
  await expect(alert).toHaveCSS("color", "rgb(179, 38, 59)");
  await expect(alert).toBeInViewport({ ratio: 1 });
  await expect(field).toBeInViewport({ ratio: 1 });
  await expect(field).toBeFocused();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveCSS("border-top-color", "rgb(179, 38, 59)");
  await expect(field).toHaveAccessibleDescription(message);
  await expect(field).toHaveValue(value);
}

for (const viewport of [{ width: 1536, height: 730 }, { width: 1920, height: 945 }]) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });
    test.skip(!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD,
      "Requires a disposable administrator.");
    let admin, patient, professional, patientHeaders, professionalHeaders, medications, professionals;
    const create = (request, path, data, headers = admin) =>
      request.post(`/api${path}`, { headers, data }).then((response) => check(response, 201));
    const get = (request, path, headers = admin) =>
      request.get(`/api${path}`, { headers }).then((response) => check(response));

    test.beforeAll(async ({ request }) => {
      test.setTimeout(90_000);
      const suffix = `${viewport.width}-${Date.now()}`;
      admin = await login(request, process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD);
      patient = await create(request, "/admin/patients", {
        ...profile, ...patientDetails, ...credentials, last_name: `Patient-${suffix}`,
        email: `ux-patient-${suffix}@example.com`,
      });
      patientHeaders = await login(request, patient.email, password);
      professionals = [];
      medications = [];
      for (let index = 1; index <= 18; index++) {
        const key = `${String(index).padStart(2, "0")}-${suffix}`;
        const provider = await create(request, "/admin/professionals", {
          ...profile, ...professionalDetails, ...credentials, last_name: `Provider-${key}`,
          email: `ux-provider-${key}@example.com`, license_number: `UX-${key}`,
        });
        professionals.push(provider);
        medications.push(await create(request, "/medications", {
          ...medication, medication_name: `UX medication ${key}`,
        }, patientHeaders));
        await create(request, "/admin/assignments", {
          patient_id: patient.id, professional_id: provider.id,
        });
      }
      await create(request, "/medications/intakes", {
        medication_id: medications.at(-1).id,
        taken_at: new Date(Date.now() - 60_000).toISOString(),
        notes: "Synthetic intake before deactivation",
      }, patientHeaders);
      professional = professionals.at(-1);
      professionalHeaders = await login(request, professional.email, password);
    });

    for (const target of ["professional", "medication"]) {
      test(`UX-01/02/03/04/05/06 lower-row ${target} editor and rejected save`, async ({ page, request }, info) => {
        const isProfessional = target === "professional";
        const record = isProfessional ? professional : medications.at(-1);
        const identity = isProfessional ? record.email : record.medication_name;
        const pageRoute = isProfessional ? "/admin/users" : "/patient/medications";
        const apiPath = isProfessional ? "/admin/users" : "/medications";
        const headers = isProfessional ? admin : patientHeaders;
        const fieldName = isProfessional ? "specialization" : "dosage";
        const label = isProfessional ? "Specialization" : "Dosage";
        const first = page.getByLabel(isProfessional ? "First name" : "Medication name", { exact: true });
        await open(page, pageRoute, headers);
        const edit = row(page, identity).getByRole("button", { name: "Edit", exact: true });
        await edit.scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
        await edit.click();
        if (baseline) {
          await expect(first).not.toBeFocused();
          await expect(first).not.toBeInViewport();
          await screenshot(page, info, "edit-offscreen");
        } else {
          await expect(first).toBeFocused();
          await expect(first).toBeInViewport({ ratio: 1 });
          const name = isProfessional ? `${record.first_name} ${record.last_name}` : identity;
          await expect(page.getByRole("heading", { name: new RegExp(target) }).filter({ hasText: name }))
            .toBeInViewport({ ratio: 1 });
          await expect(first).toHaveValue(isProfessional ? record.first_name : identity);
          if (isProfessional) await expect(page.getByLabel("Email address")).toHaveValue(identity);
          await screenshot(page, info, "editor-visible");
        }
        if (isProfessional)
          await expect(page.getByText(/Passwords require/)).toHaveCount(baseline ? 1 : 0);
        const input = page.getByLabel(label, { exact: true });
        await input.fill("   ");
        const save = page.getByRole("button", { name: `Save ${target}`, exact: true });
        const failed = page.waitForResponse((response) => response.request().method() === "PUT");
        await save.click();
        expect((await failed).status()).toBe(422);
        if (baseline) {
          await expect(page.getByRole("alert")).toContainText("String should have at least 1 character");
          await expect(input).not.toHaveAttribute("aria-invalid");
        } else {
          await fieldError(page, label, `${label} is required.`, "   ");
        }
        await screenshot(page, info, "save-error");
        expect((await get(request, apiPath, headers)).find(({ id }) => id === record.id)[fieldName])
          .toBe(record[fieldName]);
        await input.fill("Synthetic corrected value");
        await save.click();
        await expect(page.getByText(isProfessional ? "Healthcare professional saved successfully." :
          "Medication saved successfully.")).toBeInViewport();
        expect((await get(request, apiPath, headers)).find(({ id }) => id === record.id)[fieldName])
          .toBe("Synthetic corrected value");
      });
    }

    for (const role of ["patient", "professional"]) {
      test(`UX-03/04/05 ${role} profile server validation`, async ({ page, request }, info) => {
        const headers = role === "patient" ? patientHeaders : professionalHeaders;
        const label = role === "patient" ? "First name" : "Specialization";
        const key = role === "patient" ? "first_name" : "specialization";
        const before = await get(request, "/profiles/me", headers);
        await open(page, `/${role}/profile`, headers);
        const field = page.getByLabel(label, { exact: true });
        await field.fill("   ");
        const save = page.getByRole("button", { name: "Save changes" });
        const failed = page.waitForResponse((response) => response.request().method() === "PUT");
        await save.click();
        expect((await failed).status()).toBe(422);
        if (baseline) {
          await expect(page.getByRole("alert")).toContainText("String should have at least 1 character");
          if (viewport.height === 730) await expect(page.getByRole("alert")).not.toBeInViewport();
          await expect(field).not.toBeFocused();
        } else {
          await fieldError(page, label, `${label} is required.`, "   ");
        }
        await screenshot(page, info, "profile-error");
        expect((await get(request, "/profiles/me", headers))[key]).toBe(before[key]);
        await field.fill(before[key]);
        await save.click();
        await expect(page.getByText("Your profile was updated successfully.")).toBeVisible();
      });
    }

    for (const role of ["patient", "professional"]) {
      test(`UX-04/05/06/07/08 create ${role} mismatch, duplicate and blank name`, async ({ page, request }, info) => {
        const endpoint = `/api/admin/${role}s`;
        const duplicate = patient.email;
        const unique = `ux-created-${role}-${viewport.width}-${Date.now()}@example.com`;
        const before = await get(request, "/admin/users");
        await open(page, "/admin/users", admin);
        await page.getByRole("button", { name: `+ Add ${role}`, exact: true }).click();
        await expect(page.getByText(/Passwords require/)).toBeVisible();
        const fields = {
          "First name": "Synthetic", "Last name": "Create", "Email address": duplicate,
          Phone: profile.phone, "Temporary password": password, "Confirm password": "DifferentPassword123",
          ...(role === "patient" ? { "Date of birth": patientDetails.date_of_birth, Address: patientDetails.address } :
            { Specialization: "QA", "License number": unique, Workplace: "Synthetic clinic" }),
        };
        for (const [label, value] of Object.entries(fields)) await page.getByLabel(label, { exact: true }).fill(value);
        const createButton = page.getByRole("button", { name: `Create ${role}`, exact: true });
        const submits = [];
        page.on("request", (req) => {
          if (req.method() === "POST" && new URL(req.url()).pathname === endpoint) submits.push(req);
        });
        await createButton.click();
        await expect(page.getByRole("alert")).toHaveText("Passwords must match.");
        expect(submits).toHaveLength(0);
        if (baseline) await expect(page.getByRole("alert")).not.toBeInViewport();
        else await fieldError(page, "Confirm password", "Passwords must match.", fields["Confirm password"]);
        await screenshot(page, info, "password-mismatch");
        await page.getByLabel("Confirm password", { exact: true }).fill(password);
        const rejected = page.waitForResponse((response) => response.request().method() === "POST" &&
          new URL(response.url()).pathname === endpoint);
        await createButton.click();
        expect((await rejected).status()).toBe(409);
        if (baseline) {
          await expect(page.getByRole("alert")).toContainText("professional license number");
          await expect(page.getByRole("alert")).not.toBeInViewport();
        } else if (role === "patient") {
          await fieldError(page, "Email address", "This email address is already registered.", duplicate);
        } else {
          await expect(page.getByRole("alert")).toHaveText("Email or professional license number already registered.");
          await expect(page.getByRole("alert")).toBeInViewport({ ratio: 1 });
          await expect(page.getByLabel("Email address", { exact: true })).not.toHaveAttribute("aria-invalid");
          await expect(page.getByLabel("License number", { exact: true })).not.toBeFocused();
        }
        await screenshot(page, info, "duplicate-email");
        await page.getByLabel("Email address", { exact: true }).fill(unique);
        const first = page.getByLabel("First name", { exact: true });
        await first.fill("   ");
        const invalid = page.waitForResponse((response) => response.request().method() === "POST" &&
          new URL(response.url()).pathname === endpoint);
        await createButton.click();
        expect((await invalid).status()).toBe(422);
        if (baseline) await expect(page.getByRole("alert")).toContainText("String should have at least 1 character");
        else await fieldError(page, "First name", "First name is required.", "   ");
        await screenshot(page, info, "create-server-validation");
        expect((await get(request, "/admin/users")).length).toBe(before.length);
        await first.fill("Synthetic");
        await createButton.click();
        await expect(page.getByText(role === "patient" ? "Patient created successfully." :
          "Healthcare professional saved successfully.")).toBeVisible();
        expect((await get(request, "/admin/users")).filter(({ email }) => email === unique)).toHaveLength(1);
      });
    }

    test("UX-09 dirty professional editor guards other records, filters and navigation", async ({ page, request }, info) => {
      await open(page, "/admin/users", admin);
      const first = professionals.at(-2);
      const edit = (record) => row(page, record.email).getByRole("button", { name: "Edit", exact: true });
      const workplace = page.getByLabel("Workplace", { exact: true });
      const filter = page.getByRole("button", { name: "Healthcare professionals", exact: true });
      await edit(first).click();
      await workplace.fill("Unsaved synthetic workplace");
      if (baseline) {
        await edit(professional).click();
        await expect(workplace).toHaveValue(professional.workplace);
        await workplace.fill("Unsaved synthetic workplace");
        await filter.click();
        await expect(workplace).toHaveCount(0);
        await screenshot(page, info, "discarded-without-warning");
      } else {
        async function choose(action, discard) {
          const prompted = page.waitForEvent("dialog");
          page.once("dialog", (dialog) => discard ? dialog.accept() : dialog.dismiss());
          await action.click();
          expect((await prompted).message()).toBe("Discard unsaved changes?");
        }
        await choose(edit(professional), false);
        await expect(workplace).toHaveValue("Unsaved synthetic workplace");
        await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(first.email);
        await choose(edit(professional), true);
        await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(professional.email);
        await workplace.fill("Unsaved synthetic workplace");
        await choose(filter, false);
        await expect(workplace).toHaveValue("Unsaved synthetic workplace");
        await expect(filter).not.toHaveClass("selected");
        await workplace.scrollIntoViewIfNeeded();
        await screenshot(page, info, "filter-dismiss-preserves-editor");
        await choose(filter, true);
        await expect(workplace).toHaveCount(0);
        await expect(filter).toHaveClass("selected");
        let cleanPrompts = 0;
        const dismiss = (dialog) => { cleanPrompts++; return dialog.dismiss(); };
        page.on("dialog", dismiss);
        await edit(first).click();
        await workplace.fill("Changed then restored");
        await workplace.fill(first.workplace);
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await expect(workplace).toHaveCount(0);
        expect(cleanPrompts).toBe(0);
        page.off("dialog", dismiss);
        await edit(first).click();
        await workplace.fill("Unsaved synthetic workplace");
        const nav = page.getByRole("link", { name: "Assignments", exact: true });
        await choose(nav, false);
        await expect(page).toHaveURL(/\/admin\/users$/);
        await expect(workplace).toHaveValue("Unsaved synthetic workplace");
        await choose(nav, true);
        await expect(page).toHaveURL(/\/admin\/assignments$/);
      }
      const stored = await get(request, "/admin/users");
      expect(stored.find(({ id }) => id === first.id).workplace).toBe(first.workplace);
      expect(stored.find(({ id }) => id === professional.id).workplace).toBe(professional.workplace);
    });

    for (const target of ["account", "assignment", "medication"]) {
      test(`UX-${target === "account" ? "10" : "11"} lower-row ${target} feedback and status`, async ({ page, request }, info) => {
        const provider = professionals[0];
        const account = professionals.at(-1);
        const med = medications.at(-1);
        const assignment = target === "assignment" ?
          (await get(request, "/admin/assignments")).find((item) => item.professional_id === provider.id) : null;
        const [path, id, identity, actionName, message] = {
          account: ["/admin/users", account.id, account.email, "Deactivate", "Account status updated successfully."],
          assignment: ["/admin/assignments", assignment?.id, `${provider.first_name} ${provider.last_name}`,
            "Deactivate assignment", "Assignment deactivated. Historical records retained."],
          medication: ["/medications", med.id, med.medication_name, "Deactivate", "Medication updated successfully."],
        }[target];
        const headers = target === "medication" ? patientHeaders : admin;
        const history = target === "medication" ? await get(request, "/medications/intakes/history", headers) : null;
        await open(page, target === "medication" ? "/patient/medications" : path, headers);
        if (!baseline && target === "account") {
          await page.getByRole("button", { name: "Healthcare professionals", exact: true }).click();
          await page.getByRole("textbox", { name: "Search users" }).fill("Synthetic");
        }
        const selected = row(page, identity);
        const button = selected.getByRole("button", { name: actionName, exact: true });
        await button.scrollIntoViewIfNeeded();
        const before = await page.evaluate(() => window.scrollY);
        expect(before).toBeGreaterThan(0);
        const mutation = `**/api${path}/${id}${target === "account" ? "/status" : ""}`;
        if (!baseline) {
          await page.route(mutation, (route) => route.fulfill({
            status: 503, json: { detail: "Synthetic service unavailable. Try again." },
          }), { times: 1 });
          await button.click();
          await expect(selected.getByRole("alert")).toHaveText("Synthetic service unavailable. Try again.");
          await expect(selected.getByRole("alert")).toBeInViewport({ ratio: 1 });
          await expect(button).toBeInViewport();
          await screenshot(page, info, "row-error");
        }
        await button.click();
        const notice = page.getByText(message, { exact: true });
        const status = selected.getByText("Inactive", { exact: false });
        await expect(status).toBeVisible();
        if (baseline) {
          if (target === "account") {
            await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
            await expect(status).not.toBeInViewport();
          }
        } else {
          await expect(selected.getByRole("status")).toHaveText(message);
          await expect(notice).toBeInViewport({ ratio: 1 });
          await expect(status).toBeInViewport({ ratio: 1 });
          await expect(page.getByRole("alert")).toHaveCount(0);
          expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before / 2);
        }
        await screenshot(page, info, "deactivation");
        const record = (await get(request, path, headers)).find((item) => item.id === id);
        expect(target === "medication" ? record.is_active : record.status).toBe(target === "medication" ? false : "inactive");
        if (target === "assignment") expect(record.unassigned_at).toBeTruthy();
        if (target === "medication") expect(await get(request, "/medications/intakes/history", headers)).toEqual(history);
        if (!baseline && target === "account") {
          await expect(page.getByRole("button", { name: "Healthcare professionals", exact: true })).toHaveClass("selected");
          await expect(page.getByRole("textbox", { name: "Search users" })).toHaveValue("Synthetic");
          await selected.getByRole("button", { name: "Activate", exact: true }).click();
          await expect(selected.getByText(/^active$/i)).toBeInViewport();
          expect((await get(request, path)).find((item) => item.id === id).status).toBe("active");
          await screenshot(page, info, "activation");
        }
      });
    }
  });
}
