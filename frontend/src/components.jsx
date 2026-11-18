import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "./api";

export function Logo() {
  return (
    <div className="logo">
      <span aria-hidden="true">✳</span>NeuroAdapt
    </div>
  );
}
export function Heading({ title, subtitle }) {
  return (
    <div className="heading">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}
export function Card({ title, action, children, className = "" }) {
  return (
    <section className={`card ${className}`}>
      <div className="card-heading">
        {title && <h2>{title}</h2>}
        {action}
      </div>
      {children}
    </section>
  );
}
export function Notice({ children, error = false }) {
  return children ? (
    <div
      role={error ? "alert" : "status"}
      className={`notice ${error ? "error" : "success"}`}
    >
      {children}
    </div>
  ) : null;
}
export function Empty({ title, text, action, icon = "▤" }) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden="true">
        {icon}
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function ButtonLink({ to, children, secondary = false }) {
  return (
    <Link className={`button ${secondary ? "secondary" : ""}`} to={to}>
      {children}
    </Link>
  );
}
export function Badge({ children, inactive = false }) {
  return (
    <span className={`badge ${inactive ? "inactive" : ""}`}>{children}</span>
  );
}
export function Field({
  label,
  name,
  type = "text",
  required = true,
  defaultValue,
  children,
  ...props
}) {
  const id = `field-${name}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children ? (
        <select
          id={id}
          name={name}
          required={required}
          defaultValue={defaultValue ?? ""}
          {...props}
        >
          {children}
        </select>
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue ?? ""}
          {...props}
        />
      )}
    </div>
  );
}
export function Form({
  onSubmit,
  onSubmitStart,
  children,
  submit = "Save changes",
  cancel,
  initialMessage = "",
  invalidMessage,
  disabled = false,
}) {
  const [error, setError] = useState(""),
    [message, setMessage] = useState(initialMessage),
    [busy, setBusy] = useState(false);
  async function handle(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    const form = event.currentTarget;
    try {
      onSubmitStart?.();
      const data = Object.fromEntries(new FormData(form));
      if ("confirm_password" in data && data.password !== data.confirm_password)
        throw new Error("Passwords must match.");
      const result = await onSubmit(data, form);
      if (result) setMessage(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={handle}
      onInvalid={
        invalidMessage
          ? () => {
              setMessage("");
              setError(invalidMessage);
            }
          : undefined
      }
    >
      <Notice error>{error}</Notice>
      <Notice>{message}</Notice>
      {children}
      <div className="actions">
        <button disabled={busy || disabled} type="submit">
          {busy ? "Saving…" : submit}
        </button>
        {cancel}
      </div>
    </form>
  );
}
export function useData(path) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ data: null, loading: true, error: null });
    api(path)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (active) setState({ data: null, loading: false, error });
      });
    return () => {
      active = false;
    };
  }, [path, version]);
  return { ...state, reload: () => setVersion((v) => v + 1) };
}
export function DataState({ state, children }) {
  if (state.loading) return <p role="status">Loading…</p>;
  if (state.error)
    return (
      <>
        <Notice error>{state.error.message}</Notice>
        <button onClick={state.reload}>Try again</button>
      </>
    );
  return children;
}
export const fullName = (p) => `${p.first_name} ${p.last_name}`.trim();
export const dateText = (value) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "No records yet";
export function HistoryTable({ rows, patient = false }) {
  if (!rows.length)
    return (
      <Empty
        title="No medication history"
        text="No medication intake has been recorded yet."
        action={
          patient && (
            <ButtonLink to="/patient/record">Record medication</ButtonLink>
          )
        }
      />
    );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Medication</th>
            <th>Time taken</th>
            <th>Notes</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{dateText(r.taken_at)}</td>
              <td>
                {r.medication_name} {r.dosage}
              </td>
              <td>
                {new Date(r.taken_at).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </td>
              <td>{r.notes || "—"}</td>
              <td>
                <Badge>Recorded</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
