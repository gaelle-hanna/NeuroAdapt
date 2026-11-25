import React, { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Heading,
  Card,
  ButtonLink,
  Empty,
  Badge,
  DataState,
  useData,
  HistoryTable,
  fullName,
  dateText,
} from "./components";

export function Patients({ dashboard = false }) {
  const state = useData("/monitoring/patients"),
    [search, setSearch] = useState("");
  const patients = state.data || [],
    filtered = patients.filter((p) =>
      fullName(p).toLowerCase().includes(search.toLowerCase()),
    );
  return (
    <>
      <Heading
        title={dashboard ? "Healthcare dashboard" : "My patients"}
        subtitle="Monitor the patients assigned to your account."
      />
      <DataState state={state}>
        {dashboard && (
          <div className="stats">
            <Card>
              <p>Assigned patients</p>
              <strong>{patients.length}</strong>
              <small>Active patient profiles</small>
            </Card>
            <Card>
              <p>Intake records</p>
              <strong>
                {patients.reduce((sum, p) => sum + p.record_count, 0)}
              </strong>
              <small>Across assigned patients</small>
            </Card>
            <Card>
              <p>Access</p>
              <strong className="smaller">Authorized</strong>
              <small>Only assigned patients</small>
            </Card>
          </div>
        )}
        <Card title="Assigned patients">
          {!patients.length ? (
            <Empty
              title="No patients assigned"
              text="You do not have any assigned patients yet. Contact your administrator to request an assignment."
              icon="♧"
            />
          ) : (
            <>
              <div className="toolbar">
                <input
                  aria-label="Search patients"
                  placeholder="Search patient by name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Badge>{patients.length} assigned patients</Badge>
              </div>
              {!filtered.length ? (
                <p>No patients match your search.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Patient name</th>
                        <th>Account</th>
                        <th>Latest medication record</th>
                        <th>Records</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p) => (
                        <tr key={p.id}>
                          <td>{fullName(p)}</td>
                          <td>
                            <Badge>Active</Badge>
                          </td>
                          <td>{dateText(p.last_intake)}</td>
                          <td>{p.record_count}</td>
                          <td>
                            <ButtonLink
                              secondary
                              to={`/professional/patients/${p.id}`}
                            >
                              Open profile
                            </ButtonLink>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Card>
      </DataState>
    </>
  );
}

export function AccessDenied() {
  return (
    <>
      <Heading
        title="Patient access"
        subtitle="Access to patient information is restricted."
      />
      <Card title="Authorization result">
        <Empty
          title="Access denied"
          text="You are not authorized to view this patient. You can only access patients assigned to your account."
          icon="⊘"
          action={
            <ButtonLink to="/professional/patients">
              Back to my patients
            </ButtonLink>
          }
        />
      </Card>
    </>
  );
}

export function PatientMonitoring({ user }) {
  const { id } = useParams(),
    validId = /^\d+$/.test(id),
    state = useData(validId ? `/monitoring/patients/${id}` : null);
  if (!validId || state.error?.status === 403) return <AccessDenied />;
  const data = state.data;
  return (
    <DataState state={state}>
      {data && (
        <>
          <Heading
            title={`Patient monitoring: ${fullName(data.profile)}`}
            subtitle="Review patient information and medication intake records."
          />
          <Card
            title="Patient profile"
            action={<Badge>Access authorized</Badge>}
          >
            <dl>
              <dt>Full name</dt>
              <dd>{fullName(data.profile)}</dd>
              <dt>Patient status</dt>
              <dd>{data.profile.status}</dd>
              <dt>Assigned provider</dt>
              <dd>{fullName(user)}</dd>
              <dt>Email</dt>
              <dd>{data.profile.email}</dd>
              <dt>Phone</dt>
              <dd>{data.profile.phone || "Not provided"}</dd>
              <dt>Date of birth</dt>
              <dd>{data.profile.date_of_birth || "Not provided"}</dd>
              <dt>Address</dt>
              <dd>{data.profile.address || "Not provided"}</dd>
            </dl>
          </Card>
          <Card title="Medications">
            {data.medications.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Medication</th>
                      <th>Dosage</th>
                      <th>Frequency</th>
                      <th>Instructions</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.medications.map((m) => (
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No medications yet.</p>
            )}
          </Card>
          <Card title="Medication intake records">
            <HistoryTable rows={data.history} />
          </Card>
        </>
      )}
    </DataState>
  );
}
