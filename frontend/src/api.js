let token = sessionStorage.getItem("neuroadapt-token");
export function setToken(value) {
  token = value;
  if (value) sessionStorage.setItem("neuroadapt-token", value);
  else sessionStorage.removeItem("neuroadapt-token");
}
export async function api(path, method = "GET", data) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
  } catch {
    throw new Error(
      "Unable to connect. Please check your connection and try again.",
    );
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== "/auth/login")
      window.dispatchEvent(new Event("session-expired"));
    const detail = result.detail;
    const error = new Error(
      Array.isArray(detail)
        ? detail.map((e) => `${e.field}: ${e.message}`).join(" · ")
        : detail || "Something went wrong. Please try again.",
    );
    error.status = response.status;
    throw error;
  }
  return result;
}
