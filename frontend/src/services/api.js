export function token() {
  return localStorage.getItem("token");
}

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export async function api(path, { method = "GET", body, auth = false, signal, timeoutMs } = {}) {
  const headers = { "Content-Type": "application/json" };

  if (auth) {
    const t = token();
    if (!t) throw new Error("Unauthorized");
    headers.Authorization = `Bearer ${t}`;
  }

  let controller;
  let timer;
  let reqSignal = signal;
  if (timeoutMs && !reqSignal) {
    controller = new AbortController();
    reqSignal = controller.signal;
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }

  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: reqSignal,
    });
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new Error('{"error":"Сервер жауап бермеді. Кейінірек қайталаңыз."}');
    }
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }

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