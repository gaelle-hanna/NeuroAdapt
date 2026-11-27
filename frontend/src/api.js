let token = sessionStorage.getItem("neuroadapt-token");
const friendlyValidationPaths = new Set([
  "/auth/forgot-password",
  "/auth/reset-password",
  "/admin/patients",
  "/admin/professionals",
]);

function friendlyValidation({ field, message }) {
  if (field === "email" && message.startsWith("value is not a valid email address"))
    return "Enter a valid email address, such as name@example.com.";
  const text = message.replace(/^Value error,\s*/i, "");
  if (!field || text !== message) return text;
  const label = field.replaceAll("_", " ");
  return `${label[0].toUpperCase()}${label.slice(1)}: ${text}`;
}
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
        ? detail.map((e) =>
            response.status === 422 && method === "POST" && friendlyValidationPaths.has(path)
              ? friendlyValidation(e)
              : `${e.field}: ${e.message}`,
          ).join(" · ")
        : detail || "Something went wrong. Please try again.",
    );
    error.status = response.status;
    error.detail = detail;
    throw error;
  }
  return result;
}
