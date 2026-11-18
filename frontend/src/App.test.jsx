import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import App, { Protected } from "./App";
import { Form, Field, HistoryTable } from "./components";
import { RecordMedication } from "./PatientPages";
import { Patients } from "./ProfessionalPages";
import { ManageUsers } from "./AdminPages";
import { setToken } from "./api";

it("requires patient details on public registration", async () => {
  renderApp("/register");
  expect(screen.getByLabelText("Date of birth")).toBeRequired();
  expect(screen.getByLabelText("Phone")).toBeRequired();
  expect(screen.getByLabelText("Address")).toBeRequired();
  expect(screen.queryByLabelText("License number")).not.toBeInTheDocument();
});

it("requires professional details when an administrator creates a professional", async () => {
  vi.spyOn(global, "fetch").mockImplementation(() => json([]));
  render(
    <MemoryRouter>
      <ManageUsers />
    </MemoryRouter>,
  );
  await userEvent.click(
    screen.getByRole("button", {
      name: "Healthcare professionals",
      exact: true,
    }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "+ Add professional" }),
  );
  for (const label of [
    "Phone",
    "Specialization",
    "License number",
    "Workplace",
  ]) {
    expect(screen.getByLabelText(label)).toBeRequired();
  }
  expect(screen.queryByLabelText("Date of birth")).not.toBeInTheDocument();
});

beforeEach(() => {
  sessionStorage.clear();
  setToken(null);
  vi.restoreAllMocks();
});
function json(data, status = 200) {
  return Promise.resolve({
    ok: status < 400,
    status,
    json: () => Promise.resolve(data),
  });
}
function renderApp(path = "/login") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

it("adds a patient from the Patients tab using the patient endpoint", async () => {
  const fetchMock = vi
    .spyOn(global, "fetch")
    .mockImplementation(() => json([]));
  render(
    <MemoryRouter>
      <ManageUsers />
    </MemoryRouter>,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Patients", exact: true }),
  );
  expect(
    screen.queryByRole("button", { name: "+ Add professional" }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "+ Add patient" }));
  expect(screen.queryByLabelText("License number")).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("First name"), "Created");
  await userEvent.type(screen.getByLabelText("Last name"), "Patient");
  await userEvent.type(
    screen.getByLabelText("Email address"),
    "created@example.com",
  );
  await userEvent.type(screen.getByLabelText("Phone"), "+961 70123456");
  await userEvent.type(screen.getByLabelText("Address"), "Fictitious address");
  await userEvent.type(screen.getByLabelText("Date of birth"), "1970-01-01");
  await userEvent.type(
    screen.getByLabelText("Temporary password"),
    "PatientTest123",
  );
  await userEvent.type(
    screen.getByLabelText("Confirm password"),
    "PatientTest123",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Create patient", exact: true }),
  );
  expect(
    await screen.findByText("Patient created successfully."),
  ).toBeInTheDocument();
  const request = fetchMock.mock.calls.find(
    ([url, options]) =>
      url === "/api/admin/patients" && options.method === "POST",
  );
  expect(request).toBeDefined();
  expect(JSON.parse(request[1].body)).toMatchObject({
    first_name: "Created",
    email: "created@example.com",
    date_of_birth: "1970-01-01",
  });
});

describe("authentication and routing", () => {
  it("renders login and navigates to registration", async () => {
    renderApp();
    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("link", { name: "Create an account" }),
    );
    expect(screen.getByLabelText("First name")).toBeInTheDocument();
  });
  it("redirects anonymous users to login", () => {
    renderApp("/admin/users");
    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
  });
  it("denies the wrong role", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            element={<Protected user={{ role: "patient" }} role="admin" />}
          >
            <Route path="admin" element={<p>Admin content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: "Access denied" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Admin content")).not.toBeInTheDocument();
  });
  it("displays backend login errors", async () => {
    vi.spyOn(global, "fetch").mockImplementation(() =>
      json({ detail: "Incorrect email or password." }, 401),
    );
    renderApp();
    await userEvent.type(
      screen.getByLabelText("Email address"),
      "patient@example.com",
    );
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Incorrect email or password.",
    );
  });
});

describe("forms and data states", () => {
  it("validates password confirmation before submitting", async () => {
    const submit = vi.fn();
    render(
      <Form onSubmit={submit}>
        <Field label="Password" name="password" defaultValue="Password123" />
        <Field
          label="Confirm"
          name="confirm_password"
          defaultValue="different"
        />
      </Form>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Passwords must match");
    expect(submit).not.toHaveBeenCalled();
  });
  it("shows confirmation after a successful action", async () => {
    render(
      <Form onSubmit={async () => "Saved successfully"}>
        <Field label="Name" name="name" defaultValue="Test" />
      </Form>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Saved successfully",
    );
  });
  it("renders empty history with a working record link", () => {
    render(
      <MemoryRouter>
        <HistoryTable rows={[]} patient />
      </MemoryRouter>,
    );
    expect(screen.getByText("No medication history")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Record medication" }),
    ).toHaveAttribute("href", "/patient/record");
  });
  it("renders the empty medication state without a nonfunctional intake form", async () => {
    vi.spyOn(global, "fetch").mockImplementation(() => json([]));
    render(
      <MemoryRouter>
        <RecordMedication />
      </MemoryRouter>,
    );
    expect(await screen.findByText("No medications")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Add medication" }),
    ).toHaveAttribute("href", "/patient/medications");
    expect(
      screen.queryByRole("button", { name: "Save medication record" }),
    ).not.toBeInTheDocument();
  });
  it("renders the empty assigned-patients state", async () => {
    vi.spyOn(global, "fetch").mockImplementation(() => json([]));
    render(
      <MemoryRouter>
        <Patients />
      </MemoryRouter>,
    );
    expect(await screen.findByText("No patients assigned")).toBeInTheDocument();
  });
  it("shows a retry action for a server failure", async () => {
    vi.spyOn(global, "fetch").mockImplementation(() =>
      json({ detail: "Database unavailable" }, 503),
    );
    render(
      <MemoryRouter>
        <Patients />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Database unavailable",
    );
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
});
