import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "./api";
import {
  Heading,
  Card,
  ButtonLink,
  Field,
  Form,
  Empty,
  DataState,
  useData,
  HistoryTable,
  Badge,
  Notice,
  fullName,
  dateText,
} from "./components";

export function PatientDashboard({ user }) {
  const state = useData("/medications/intakes/history");
  const medications = useData("/medications");
  const rows = state.data || [],
    week = rows.filter(
      (r) => new Date(r.taken_at) >= new Date(Date.now() - 7 * 86400000),
    ).length;
  return (
    <>
      <Heading
        title={`Welcome, ${user.first_name}`}
        subtitle="Here are your main actions for today."
      />
      <DataState state={state}>
        <div className="stats">
          <Card>
            <p>Medication records</p>
            <strong>{week}</strong>
            <small>Recorded in the last 7 days</small>
          </Card>
          <Card>
            <p>Last medication</p>
            <strong className="smaller">
              {rows.length
                ? new Date(rows[0].taken_at).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "No records yet"}
            </strong>
            <small>
              {rows.length
                ? dateText(rows[0].taken_at)
                : "Record your first intake"}
            </small>
          </Card>
          <Card>
            <p>Account</p>
            <strong>Active</strong>
            <small>Your profile is ready</small>
          </Card>
        </div>
        <div className="two-columns">
          <Card title="Record medication">
            <p>Taken your medicine? Record it in a few steps.</p>
            <ButtonLink to="/patient/record">Record medication</ButtonLink>
          </Card>
          <Card title="Medication history">
            <p>See the medications you have recorded.</p>
            <ButtonLink secondary to="/patient/history">
              View medication history
            </ButtonLink>
          </Card>
        </div>
        <Card title="Recent activity">
          <HistoryTable rows={rows.slice(0, 5)} patient />
        </Card>
      </DataState>
      <Card
        title="My medications"
        action={<ButtonLink to="/patient/medications">My Medications</ButtonLink>}
      >
        <DataState state={medications}>
          <p>Medications saved: {medications.data?.length}</p>
        </DataState>
      </Card>
    </>
  );
}

export function RecordMedication() {
  const state = useData("/medications");
  const active = (state.data || []).filter((m) => m.is_active);
  return (
    <>
      <Heading
        title="Record medication"
        subtitle="Select your medication and enter when you took it."
      />
      <DataState state={state}>
        <Card
          title="New medication intake"
          action={
            <ButtonLink secondary to="/patient/medications">
              Manage medications
            </ButtonLink>
          }
        >
          {!active.length ? (
            <Empty
              title="No medications"
              text="Add your medication entries before recording an intake."
              icon="+"
              action={
                <ButtonLink to="/patient/medications">
                  Add medication
                </ButtonLink>
              }
            />
          ) : (
            <Form
              invalidMessage="Please select a medication and enter a valid intake date and time."
              onSubmit={async (data, form) => {
                await api("/medications/intakes", "POST", {
                  medication_id: Number(data.medication_id),
                  taken_at: new Date(`${data.date}T${data.time}`).toISOString(),
                  notes: data.notes || null,
                });
                form.reset();
                return "Medication intake saved successfully.";
              }}
              submit="Save medication record"
              cancel={
                <ButtonLink secondary to="/patient">
                  Cancel
                </ButtonLink>
              }
            >
              <div className="notice info">
                Only active medications from your account appear in this list.
              </div>
              <div className="form-grid">
                <Field label="Medication" name="medication_id">
                  <option value="">Select medication</option>
                  {active.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.medication_name} {m.dosage}
                    </option>
                  ))}
                </Field>
                <Field
                  label="Date"
                  name="date"
                  type="date"
                  max={new Date().toLocaleDateString("en-CA")}
                />
                <Field label="Time taken" name="time" type="time" />
                <Field
                  label="Notes (optional)"
                  name="notes"
                  required={false}
                  maxLength={5000}
                />
              </div>
            </Form>
          )}
        </Card>
      </DataState>
    </>
  );
}

export function MedicationHistory() {
  const state = useData("/medications/intakes/history");
  return (
    <>
      <Heading
        title="Medication history"
        subtitle="Review your previously recorded medication intake."
      />
      <Card
        title="Previous medication records"
        action={<ButtonLink to="/patient/record">Record medication</ButtonLink>}
      >
        <DataState state={state}>
          <HistoryTable rows={state.data || []} patient />
        </DataState>
      </Card>
    </>
  );
}

export function MedicationFields({ medication = {} }) {
  return (
    <div className="form-grid">
      <Field
        label="Medication name"
        name="medication_name"
        maxLength={150}
        defaultValue={medication.medication_name}
      />
      <Field
        label="Dosage"
        name="dosage"
        maxLength={100}
        defaultValue={medication.dosage}
      />
      <Field
        label="Frequency"
        name="frequency"
        maxLength={100}
        defaultValue={medication.frequency}
      />
      <Field
        label="Instructions (optional)"
        name="instructions"
        required={false}
        maxLength={5000}
        defaultValue={medication.instructions}
      />
    </div>
  );
}

export function Medications() {
  const state = useData("/medications"),
    [editing, setEditing] = useState(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  function clearFeedback() {
    setMessage("");
    setError("");
  }
  async function toggle(m) {
    clearFeedback();
    setBusy(true);
    try {
      await api(`/medications/${m.id}`, "PUT", {
        medication_name: m.medication_name,
        dosage: m.dosage,
        frequency: m.frequency,
        instructions: m.instructions,
        is_active: !m.is_active,
      });
      setMessage("Medication updated successfully.");
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
        title="My medications"
        subtitle="Manage your own medication entries for intake tracking."
      />
      <Notice>{message}</Notice>
      <Notice error>{error}</Notice>
      <Card title={editing ? "Edit medication" : "Add medication"}>
        <Form
          key={editing?.id || "new"}
          disabled={busy}
          onSubmitStart={clearFeedback}
          onSubmit={async (data, form) => {
            setBusy(true);
            try {
              await api(
                editing ? `/medications/${editing.id}` : "/medications",
                editing ? "PUT" : "POST",
                { ...data, is_active: editing ? editing.is_active : true },
              );
              setEditing(null);
              form.reset();
              setMessage("Medication saved successfully.");
              state.reload();
            } finally {
              setBusy(false);
            }
          }}
          submit={editing ? "Save medication" : "Add medication"}
          cancel={
            editing && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            )
          }
        >
          <MedicationFields medication={editing || {}} />
        </Form>
      </Card>
      <Card title="Your medication entries">
        <DataState state={state}>
          {state.data?.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Medication</th>
                    <th>Dosage</th>
                    <th>Frequency</th>
                    <th>Instructions</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.map((m) => (
                    <tr key={m.id}>
                      <td>{m.medication_name}</td>
                      <td>{m.dosage}</td>
                      <td>{m.frequency}</td>
                      <td>{m.instructions || "—"}</td>
                      <td>
                        <Badge inactive={!m.is_active}>
                          {m.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td>
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => {
                            clearFeedback();
                            setEditing(m);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => toggle(m)}
                        >
                          {m.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No medications"
              text="Use the form above to add your first medication."
            />
          )}
        </DataState>
      </Card>
    </>
  );
}

export function RoleDetailsFields({
  profile = {},
  professional = false,
  required = false,
}) {
  const today = new Date();
  const maxBirthDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return (
    <fieldset className="role-details">
      <legend>
        {professional ? "Professional details" : "Patient details"}
      </legend>
      <p className="form-help">
        {professional
          ? "Enter your professional registration and practice information."
          : "Enter the patient's date of birth and contact information."}
      </p>
      <div className="form-grid">
        {!professional && (
          <Field
            label="Date of birth"
            name="date_of_birth"
            type="date"
            required={required}
            max={maxBirthDate}
            defaultValue={profile.date_of_birth}
            autoComplete="bday"
          />
        )}
        <Field
          label="Phone"
          name="phone"
          type="tel"
          required={required}
          defaultValue={profile.phone}
          pattern=" *\+?(?:[ \(\)\-]*[0-9]){7,15}[ \(\)\-]*"
          title="Enter 7 to 15 digits. Spaces, parentheses, hyphens and a leading + are supported."
          autoComplete="tel"
          placeholder="Include country code, e.g. +961 70123456"
        />
        {professional ? (
          <>
            <Field
              label="Specialization"
              name="specialization"
              defaultValue={profile.specialization}
              maxLength={100}
              placeholder="e.g. Neurology or physiotherapy"
            />
            <Field
              label="License number"
              name="license_number"
              defaultValue={profile.license_number}
              maxLength={100}
              placeholder="Professional registration / license number"
            />
            <Field
              label="Workplace"
              name="workplace"
              required={required}
              defaultValue={profile.workplace}
              maxLength={150}
              autoComplete="organization"
              placeholder="Hospital, clinic, or independent practice"
            />
          </>
        ) : (
          <Field
            label="Address"
            name="address"
            required={required}
            defaultValue={profile.address}
            maxLength={255}
            autoComplete="street-address"
            placeholder="Street, city, and country"
          />
        )}
      </div>
    </fieldset>
  );
}

export function ProfileFields({
  profile,
  professional = false,
  creating = false,
}) {
  return (
    <>
      <fieldset className="role-details">
        <legend>Personal information</legend>
        <div className="form-grid">
          <Field
            label="First name"
            name="first_name"
            defaultValue={profile.first_name}
            maxLength={100}
            autoComplete="given-name"
          />
          <Field
            label="Last name"
            name="last_name"
            defaultValue={profile.last_name}
            maxLength={100}
            autoComplete="family-name"
          />
          <Field
            label="Email address"
            name="email"
            type="email"
            defaultValue={profile.email}
            maxLength={255}
            autoComplete="email"
          />
        </div>
      </fieldset>
      <RoleDetailsFields
        profile={profile}
        professional={professional}
        required={creating}
      />
    </>
  );
}

export function MyProfile({ user, onUpdate }) {
  const state = useData("/profiles/me");
  const [revision, setRevision] = useState(0);
  return (
    <>
      <Heading
        title="My profile"
        subtitle="View and update your personal information."
      />
      <Card title="Personal information">
        <DataState state={state}>
          {state.data && (
            <Form
              key={revision}
              onSubmit={async (data) => {
                Object.keys(data).forEach((k) => {
                  if (!data[k]) data[k] = null;
                });
                const result = await api(`/profiles/${user.role}`, "PUT", data);
                onUpdate(result);
                return "Your profile was updated successfully.";
              }}
              cancel={
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setRevision((v) => v + 1);
                    state.reload();
                  }}
                >
                  Cancel
                </button>
              }
            >
              <ProfileFields
                profile={state.data}
                professional={user.role === "professional"}
              />
            </Form>
          )}
        </DataState>
      </Card>
    </>
  );
}
