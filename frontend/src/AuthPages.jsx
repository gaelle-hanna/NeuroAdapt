import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { api, setToken } from "./api";
import { Logo, Field, Form, Notice } from "./components";
import { RoleDetailsFields } from "./PatientPages";

const content = {
  login: [
    "Your rehabilitation, made simpler.",
    "An accessible place to manage medication records and follow your care plan.",
    "Welcome back",
    "Sign in to your NeuroAdapt account.",
  ],
  register: [
    "Care starts with one simple step.",
    "Create an account to securely record your medication and view your medication history.",
    "Create your account",
    "Patient registration — complete the fields below.",
  ],
  forgot: [
    "Recover access securely.",
    "A simple process helps you return to your account safely.",
    "Reset your password",
    "Enter your registered email address. We will send you a secure reset link.",
  ],
  reset: [
    "Your account, protected.",
    "After successfully resetting your password, you can return to the login page.",
    "Choose a new password",
    "Enter and confirm your new password.",
  ],
};
export default function AuthPage({ mode, onLogin }) {
  const navigate = useNavigate(),
    location = useLocation();
  const [developmentLink, setDevelopmentLink] = React.useState("");
  const [hero, description, title, subtitle] = content[mode];
  async function submit(data) {
    if (mode === "login") {
      const result = await api("/auth/login", "POST", data);
      setToken(result.access_token);
      onLogin(result.user);
      navigate(`/${result.user.role}`, { replace: true });
    } else if (mode === "register") {
      await api("/auth/register", "POST", data);
      navigate("/login", {
        state: { message: "Account created successfully. Please log in." },
      });
    } else if (mode === "forgot") {
      setDevelopmentLink("");
      const result = await api("/auth/forgot-password", "POST", data);
      setDevelopmentLink(result.development_reset_link || "");
      return result.message;
    } else {
      const token = new URLSearchParams(location.hash.slice(1)).get("token");
      if (!token)
        throw new Error(
          "Invalid reset link. Request a new link from the forgot password page.",
        );
      await api("/auth/reset-password", "POST", { ...data, token });
      navigate("/login", {
        state: { message: "Password updated successfully. Please log in." },
      });
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-hero">
        <Logo />
        <div className="hero-copy">
          <small>PATIENT-CENTERED CARE</small>
          <h1>{hero}</h1>
          <p>{description}</p>
          <span className="dots" aria-hidden="true">
            •　 •　 •
          </span>
        </div>
        <footer>Designed for clarity. Built for care.</footer>
      </aside>
      <main className="auth-main">
        <section className="auth-card">
          <h1>{title}</h1>
          <p>{subtitle}</p>
          <Notice>{location.state?.message}</Notice>
          <Form
            key={mode}
            onSubmit={submit}
            submit={
              {
                login: "Log in",
                register: "Create account",
                forgot: "Send reset link",
                reset: "Update password",
              }[mode]
            }
          >
            {mode === "register" && (
              <div className="form-grid">
                <Field
                  label="First name"
                  name="first_name"
                  maxLength={100}
                  autoComplete="given-name"
                />
                <Field
                  label="Last name"
                  name="last_name"
                  maxLength={100}
                  autoComplete="family-name"
                />
              </div>
            )}
            {mode !== "reset" && (
              <Field
                label="Email address"
                name="email"
                type="email"
                maxLength={255}
                autoComplete="email"
                placeholder="you@example.com"
              />
            )}
            {mode === "register" && <RoleDetailsFields required />}
            {mode !== "forgot" && (
              <div className={mode === "register" ? "form-grid" : ""}>
                <Field
                  label={mode === "reset" ? "New password" : "Password"}
                  name="password"
                  type="password"
                  minLength={mode === "login" ? 1 : 10}
                  maxLength={128}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                />
                {["register", "reset"].includes(mode) && (
                  <Field
                    label="Confirm password"
                    name="confirm_password"
                    type="password"
                    maxLength={128}
                    autoComplete="new-password"
                  />
                )}
              </div>
            )}
            {mode === "login" && (
              <div className="forgot-link">
                <Link to="/forgot-password">Forgot password?</Link>
              </div>
            )}
            {["register", "reset"].includes(mode) && (
              <div className="notice info">
                Use at least 10 characters including a letter and a number.
              </div>
            )}
          </Form>
          {mode === "login" ? (
            <div className="auth-bottom">
              <span>New to NeuroAdapt?</span>
              <Link to="/register">Create an account</Link>
            </div>
          ) : (
            <div className="auth-bottom">
              <Link to="/login">← Back to log in</Link>
            </div>
          )}
          {developmentLink && (
            <div className="notice info">
              <strong>Development only — SMTP is not configured.</strong>
              <p>
                <a href={developmentLink}>Open local password reset link</a>
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
