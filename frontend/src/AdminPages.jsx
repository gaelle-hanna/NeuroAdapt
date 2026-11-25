import React, { useState } from "react";
import { api } from "./api";
import {
  Heading,
  Card,
  ButtonLink,
  Field,
  Form,
  Empty,
  Badge,
  Notice,
  DataState,
  useData,
  fullName,
  dateText,
} from "./components";
import { ProfileFields } from "./PatientPages";

export function AdminDashboard() {
  const state = useData("/admin/users"),
    assignments = useData("/admin/assignments");
  return (
    <>
      <Heading
        title="Administrator dashboard"
        subtitle="Manage user accounts and patient assignments."
      />
      <DataState state={state}>
        <div className="stats">
          {[
            ["User accounts", state.data?.length],
            [
              "Patients",
              state.data?.filter((u) => u.role === "patient").length,
            ],
            [
              "Healthcare professionals",
              state.data?.filter((u) => u.role === "professional").length,
            ],
          ].map(([label, value]) => (
            <Card key={label}>
              <p>{label}</p>
              <strong>{value}</strong>
            </Card>
          ))}
        </div>
      </DataState>
      <div className="two-columns">
        <Card title="Manage users">
          <p>
            Create patient and healthcare professional accounts and manage
            account status.
          </p>
          <ButtonLink to="/admin/users">Manage users</ButtonLink>
        </Card>
        <Card title="Patient assignments">
          <DataState state={assignments}>
            <p>
              {assignments.data?.filter((a) => a.status === "active").length}{" "}
              active assignments
            </p>
          </DataState>
          <ButtonLink secondary to="/admin/assignments">
            Manage assignments
          </ButtonLink>
        </Card>
      </div>
    </>
  );
}

export function ManageUsers() {
  const state = useData("/admin/users"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [editing, setEditing] = useState(null),
    [adding, setAdding] = useState(false),
    [feedbackVersion, setFeedbackVersion] = useState(0),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const users = (state.data || []).filter(
    (u) =>
      (filter === "all" || u.role === filter) &&
      `${fullName(u)} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  function clearFeedback() {
    setMessage("");
    setError("");
  }
  async function toggle(u) {
    clearFeedback();
    setFeedbackVersion((version) => version + 1);
    setBusy(true);
    try {
      await api(`/admin/users/${u.id}/status`, "PATCH", {
        status: u.status === "active" ? "inactive" : "active",
      });
      setMessage("Account status updated successfully.");
      state.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title="Manage users"
        subtitle="Create patients and healthcare professionals and manage user accounts."
      />
      <Notice>{message}</Notice>
      <Notice error>{error}</Notice>
      {(adding || editing) && (
        <Card
          title={
            editing
              ? "Edit healthcare professional"
              : adding === "patient"
                ? "Create patient"
                : "Create healthcare professional"
          }
        >
          <Form
            key={editing?.id || adding}
            disabled={busy}
            onSubmitStart={clearFeedback}
            feedbackVersion={feedbackVersion}
            submit={
              editing
                ? "Save professional"
                : adding === "patient"
                  ? "Create patient"
                  : "Create professional"
            }
            onSubmit={async (data) => {
              if (editing && !data.phone) data.phone = null;
              if (adding === "patient") {
                for (const field of ["phone", "date_of_birth", "address"]) {
                  if (!data[field]) data[field] = null;
                }
              }
              setBusy(true);
              try {
                await api(
                  editing
                    ? `/admin/professionals/${editing.id}`
                    : adding === "patient"
                      ? "/admin/patients"
                      : "/admin/professionals",
                  editing ? "PUT" : "POST",
                  data,
                );
                setEditing(null);
                setAdding(false);
                setMessage(
                  adding === "patient"
                    ? "Patient created successfully."
                    : "Healthcare professional saved successfully.",
                );
                state.reload();
              } finally {
                setBusy(false);
              }
            }}
            cancel={
              <button
                className="secondary"
                type="button"
                disabled={busy}
                onClick={() => {
                  setAdding(false);
                  setEditing(null);
                }}
              >
                Cancel
              </button>
            }
          >
            <ProfileFields
              profile={editing || {}}
              professional={Boolean(editing) || adding === "professional"}
              creating={!editing}
            />
            {!editing && (
              <div className="form-grid">
                <Field
                  label="Temporary password"
                  name="password"
                  type="password"
                  minLength={10}
                  maxLength={128}
                  autoComplete="new-password"
                />
                <Field
                  label="Confirm password"
                  name="confirm_password"
                  type="password"
                  autoComplete="new-password"
                />
              </div>
            )}
            <div className="notice info">
              Passwords require at least 10 characters, including a letter and a
              number.
            </div>
          </Form>
        </Card>
      )}
      <Card title="User accounts">
        <div className="toolbar">
          <input
            aria-label="Search users"
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {filter !== "professional" && (
            <button
              disabled={busy}
              onClick={() => {
                setAdding("patient");
                setEditing(null);
                clearFeedback();
              }}
            >
              + Add patient
            </button>
          )}
          {filter !== "patient" && (
            <button
              disabled={busy}
              onClick={() => {
                setAdding("professional");
                setEditing(null);
                clearFeedback();
              }}
            >
              + Add professional
            </button>
          )}
        </div>
        <div className="tabs" aria-label="Filter users">
          {[
            ["all", "All users"],
            ["patient", "Patients"],
            ["professional", "Healthcare professionals"],
          ].map(([value, label]) => (
            <button
              key={value}
              disabled={busy}
              className={filter === value ? "selected" : ""}
              onClick={() => {
                setFilter(value);
                setAdding(false);
                setEditing(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <DataState state={state}>
          {users.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Account status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{fullName(u)}</td>
                      <td>{u.email}</td>
                      <td>
                        {u.role === "professional"
                          ? "Healthcare Professional"
                          : u.role === "admin"
                            ? "Administrator"
                            : "Patient"}
                      </td>
                      <td>
                        <Badge inactive={u.status !== "active"}>
                          {u.status}
                        </Badge>
                      </td>
                      <td>
                        {u.role === "professional" && (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => {
                              setEditing(u);
                              setAdding(false);
                              clearFeedback();
                            }}
                          >
                            Edit
                          </button>
                        )}
                        {u.role !== "admin" && (
                          <button
                            disabled={busy}
                            className="text-button"
                            onClick={() => toggle(u)}
                          >
                            {u.status === "active" ? "Deactivate" : "Activate"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No users match your search.</p>
          )}
        </DataState>
      </Card>
    </>
  );
}

export function Assignments() {
  const users = useData("/admin/users"),
    state = useData("/admin/assignments"),
    [feedbackVersion, setFeedbackVersion] = useState(0),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const available = users.data || [];
  function clearFeedback() {
    setMessage("");
    setError("");
  }
  async function remove(a) {
    clearFeedback();
    setFeedbackVersion((version) => version + 1);
    setBusy(true);
    try {
      await api(`/admin/assignments/${a.id}`, "DELETE");
      setMessage("Assignment deactivated. Historical records retained.");
      state.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title="Patient assignments"
        subtitle="Manage which healthcare professionals can access each patient."
      />
      <Notice>{message}</Notice>
      <Notice error>{error}</Notice>
      <Card title="Assign a healthcare professional">
        <DataState state={users}>
          <Form
            submit="Save assignment"
            disabled={busy}
            onSubmitStart={clearFeedback}
            feedbackVersion={feedbackVersion}
            onSubmit={async (data) => {
              setBusy(true);
              try {
                const result = await api("/admin/assignments", "POST", {
                  patient_id: Number(data.patient_id),
                  professional_id: Number(data.professional_id),
                });
                setMessage(result.message);
                state.reload();
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Select patient" name="patient_id">
              <option value="">Select patient</option>
              {available
                .filter((u) => u.role === "patient" && u.status === "active")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {fullName(u)} — {u.email}
                  </option>
                ))}
            </Field>
            <Field
              label="Select healthcare professional"
              name="professional_id"
            >
              <option value="">Select healthcare professional</option>
              {available
                .filter(
                  (u) => u.role === "professional" && u.status === "active",
                )
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {fullName(u)} — {u.email}
                  </option>
                ))}
            </Field>
          </Form>
        </DataState>
      </Card>
      <Card title="Assignments">
        <DataState state={state}>
          {state.data?.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Healthcare professional</th>
                    <th>Assigned</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.map((a) => (
                    <tr key={a.id}>
                      <td>{fullName(a.patient)}</td>
                      <td>{fullName(a.professional)}</td>
                      <td>{dateText(a.assigned_at + "Z")}</td>
                      <td>
                        <Badge inactive={a.status !== "active"}>
                          {a.status === "active" ? "Assigned" : "Inactive"}
                        </Badge>
                      </td>
                      <td>
                        {a.status === "active" ? (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => remove(a)}
                          >
                            Deactivate assignment
                          </button>
                        ) : (
                          `Ended ${dateText(a.unassigned_at + "Z")}`
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No assignments"
              text="Select a patient and healthcare professional above to create an assignment."
            />
          )}
        </DataState>
      </Card>
    </>
  );
}
