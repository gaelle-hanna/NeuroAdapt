import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
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
const FieldErrors = createContext(null);

export function focusEditor(form) {
  form.querySelector("input, select")?.focus({ preventScroll: true });
  const card = form.parentElement;
  card.scrollIntoView?.({ block: card.getBoundingClientRect().height > window.innerHeight ? "start" : "nearest" });
}

function fieldFeedback(error, labels, patientCreation) {
  if (patientCreation && error.status === 409 && [
    "Email or professional license number already registered.",
    "This email, license number, or assignment already exists.",
  ].includes(error.detail)) {
    return { fields: { email: "This email address is already registered." } };
  }
  if (error.status !== 422 || !Array.isArray(error.detail))
    return { message: error.message };

  const fields = {};
  const messages = [];
  for (const { field, message } of error.detail) {
    const label = labels.get(field);
    let text = message.replace(/^Value error,\s*/i, "");
    if (!field && text === "Passwords must match") {
      fields.confirm_password = "Passwords must match.";
    } else if (!field && text === "Use at least 10 characters including a letter and a number") {
      fields.password = text;
    } else if (label) {
      const min = /^String should have at least (\d+) character/.exec(text);
      const max = /^String should have at most (\d+) character/.exec(text);
      if (text === "Field required" || min?.[1] === "1") text = `${label} is required.`;
      else if (min) text = `${label} must have at least ${min[1]} characters.`;
      else if (max) text = `${label} must have at most ${max[1]} characters.`;
      else if (field === "email" && text.startsWith("value is not a valid email address"))
        text = "Enter a valid email address, such as name@example.com.";
      else if (field === "date_of_birth" && text.startsWith("Input should be a valid date"))
        text = "Enter a valid date of birth.";
      fields[field] = fields[field] ? `${fields[field]} ${text}` : text;
    } else {
      messages.push(text);
    }
  }
  return { fields, message: messages.join(" · ") };
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
  const error = useContext(FieldErrors)?.[name];
  const feedback = error ? {
    "aria-invalid": true,
    "aria-describedby": [props["aria-describedby"], `${id}-error`].filter(Boolean).join(" "),
  } : {};
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
          {...feedback}
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
          {...feedback}
        />
      )}
      {error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}
    </div>
  );
}
export function Form({
  onSubmit,
  onSubmitStart,
  feedbackVersion,
  children,
  submit = "Save changes",
  cancel,
  initialMessage = "",
  invalidMessage,
  disabled = false,
  inlineErrors = false,
  patientCreation = false,
  focusOnOpen = false,
  formRef,
}) {
  const [error, setError] = useState(""),
    [message, setMessage] = useState(initialMessage),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(null);
  const localRef = useRef(null);
  const ref = formRef || localRef;
  useLayoutEffect(() => {
    if (focusOnOpen) focusEditor(ref.current);
  }, [focusOnOpen, ref]);
  useLayoutEffect(() => {
    if (!failure || failure.edited) return;
    const input = ref.current.querySelector('[aria-invalid="true"]');
    if (input) {
      input.focus({ preventScroll: true });
      input.closest(".field")?.scrollIntoView?.({ block: "nearest" });
    } else {
      ref.current.querySelector(".notice.error")?.scrollIntoView?.({ block: "nearest" });
    }
  }, [failure, ref]);
  useEffect(() => {
    if (feedbackVersion !== undefined) {
      setError("");
      setMessage("");
      setFailure(null);
    }
  }, [feedbackVersion]);
  async function handle(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setFailure(null);
    setBusy(true);
    const form = event.currentTarget;
    try {
      onSubmitStart?.();
      const data = Object.fromEntries(new FormData(form));
      if ("confirm_password" in data && data.password !== data.confirm_password) {
        if (inlineErrors) setFailure({ fields: { confirm_password: "Passwords must match." } });
        else setError("Passwords must match.");
        return;
      }
      const result = await onSubmit(data, form);
      if (result) setMessage(result);
    } catch (e) {
      if (inlineErrors) {
        const labels = new Map(Array.from(form.elements, (control) => [
          control.name, control.labels?.[0]?.textContent,
        ]));
        setFailure(fieldFeedback(e, labels, patientCreation));
      } else setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      ref={ref}
      onSubmit={handle}
      onChange={failure?.fields ? ({ target }) => {
        if (!failure.fields[target.name]) return;
        const fields = { ...failure.fields };
        delete fields[target.name];
        setFailure({ ...failure, fields, edited: true });
      } : undefined}
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
      <FieldErrors.Provider value={failure?.fields}>{children}</FieldErrors.Provider>
      <Notice error>{failure?.message}</Notice>
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
    if (path === null) return;
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
  return {
    ...state,
    reload: () => setVersion((v) => v + 1),
    updateData: (update) => setState((current) => ({ ...current, data: update(current.data) })),
  };
}
export function RowFeedback({ feedback }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (feedback) ref.current.scrollIntoView?.({ block: "nearest" });
  }, [feedback]);
  return feedback && (
    <div ref={ref} className="row-feedback">
      <Notice error={feedback.error}>{feedback.message}</Notice>
    </div>
  );
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
