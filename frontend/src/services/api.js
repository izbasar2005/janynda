export function token() {
  return localStorage.getItem("token");
}

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export async function api(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };

  if (auth) {
    const t = token();
    if (!t) throw new Error("Unauthorized");
    headers.Authorization = `Bearer ${t}`;
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth) {
    clearSession();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}