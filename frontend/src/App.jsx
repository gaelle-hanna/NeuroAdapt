import React, { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  Link,
} from "react-router-dom";
import { api, setToken } from "./api";
import { Logo, fullName, Empty, ButtonLink } from "./components";
import AuthPage from "./AuthPages";
import {
  PatientDashboard,
  RecordMedication,
  MedicationHistory,
  Medications,
  MyProfile,
} from "./PatientPages";
import { Patients, PatientMonitoring } from "./ProfessionalPages";
import { AdminDashboard, ManageUsers, Assignments } from "./AdminPages";

const roleNames = {
  patient: "Patient",
  professional: "Healthcare Professional",
  admin: "Administrator",
};
const navigation = {
  patient: [
    ["", "▦", "Dashboard"],
    ["/record", "✚", "Record Medication"],
    ["/history", "▤", "Medication History"],
    ["/profile", "○", "My Profile"],
  ],
  professional: [
    ["", "▦", "Dashboard"],
    ["/patients", "♧", "My Patients"],
    ["/profile", "○", "My Profile"],
  ],
  admin: [
    ["", "▦", "Dashboard"],
    ["/users", "♙", "Manage Users"],
    ["/assignments", "⇄", "Assignments"],
  ],
};
export function Protected({ user, role }) {
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role)
    return (
      <div className="standalone">
        <Empty
          title="Access denied"
          text="This page is not available for your account."
          action={
            <ButtonLink to={`/${user.role}`}>Back to dashboard</ButtonLink>
          }
        />
      </div>
    );
  return <Outlet />;
}
function Layout({ user, logout }) {
  const location = useLocation(),
    [help, setHelp] = useState(false);
  const initials =
    user.role === "admin"
      ? "AD"
      : `${user.first_name[0] || ""}${user.last_name[0] || ""}`.toUpperCase();
  const nav = navigation[user.role];
  const title =
    nav.find(
      ([path]) => path && location.pathname.startsWith(`/${user.role}${path}`),
    )?.[2] ||
    (location.pathname.endsWith("/medications")
      ? "My Medications"
      : "Dashboard");
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Logo />
        <div className="role-label">{roleNames[user.role]}</div>
        <nav>
          {nav.map(([path, icon, label]) => (
            <NavLink key={path} end={!path} to={`/${user.role}${path}`}>
              <span aria-hidden="true">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="account">
          <div className="avatar">{initials}</div>
          <div>
            <strong>{fullName(user)}</strong>
            {user.role !== "admin" && (
              <Link to={`/${user.role}/profile`}>Account settings</Link>
            )}
            <button className="text-button" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <span>
            NeuroAdapt <i>/</i> {roleNames[user.role]} <i>/</i> {title}
          </span>
          <div className="header-right">
            <button className="text-button" onClick={() => setHelp((v) => !v)}>
              Help
            </button>
            <span className="avatar">{initials}</span>
          </div>
        </header>
        <main>
          {help && (
            <section className="notice info">
              <strong>NeuroAdapt help</strong>
              <p>
                Use the navigation to manage your profile and medication
                records. Contact your administrator for account or assignment
                help.
              </p>
              <p>
                Academic prototype. This application does not provide medical
                advice.
              </p>
              <button className="text-button" onClick={() => setHelp(false)}>
                Close help
              </button>
            </section>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
export default function App() {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true);
  function logout() {
    setToken(null);
    setUser(null);
  }
  useEffect(() => {
    let active = true;
    if (!sessionStorage.getItem("neuroadapt-token")) {
      setLoading(false);
      return;
    }
    api("/auth/me")
      .then((u) => {
        if (active) setUser(u);
      })
      .catch(() => {
        if (active) logout();
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    window.addEventListener("session-expired", logout);
    return () => window.removeEventListener("session-expired", logout);
  }, []);
  if (loading)
    return (
      <div className="standalone" role="status">
        Loading your account…
      </div>
    );
  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={user ? `/${user.role}` : "/login"} replace />}
      />
      {[
        ["/login", "login"],
        ["/register", "register"],
        ["/forgot-password", "forgot"],
        ["/reset-password", "reset"],
      ].map(([path, mode]) => (
        <Route
          key={path}
          path={path}
          element={<AuthPage mode={mode} onLogin={setUser} />}
        />
      ))}
      {["patient", "professional", "admin"].map((role) => (
        <Route key={role} element={<Protected user={user} role={role} />}>
          <Route
            path={`/${role}`}
            element={user && <Layout user={user} logout={logout} />}
          >
            {role === "patient" ? (
              <>
                <Route index element={<PatientDashboard user={user} />} />
                <Route path="record" element={<RecordMedication />} />
                <Route path="history" element={<MedicationHistory />} />
                <Route path="medications" element={<Medications />} />
              </>
            ) : role === "professional" ? (
              <>
                <Route index element={<Patients dashboard />} />
                <Route path="patients" element={<Patients />} />
                <Route
                  path="patients/:id"
                  element={<PatientMonitoring user={user} />}
                />
              </>
            ) : (
              <>
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<ManageUsers />} />
                <Route path="assignments" element={<Assignments />} />
              </>
            )}
            {role !== "admin" && (
              <Route
                path="profile"
                element={<MyProfile user={user} onUpdate={setUser} />}
              />
            )}
            <Route
              path="*"
              element={
                <Empty
                  title="Page not found"
                  action={
                    <ButtonLink to={`/${role}`}>Back to dashboard</ButtonLink>
                  }
                />
              }
            />
          </Route>
        </Route>
      ))}
      <Route
        path="*"
        element={
          <div className="standalone">
            <Empty
              title="Page not found"
              action={<ButtonLink to="/">Go home</ButtonLink>}
            />
          </div>
        }
      />
    </Routes>
  );
}
