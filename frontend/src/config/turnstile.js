// Same Turnstile site key on localhost and production (janynda.onrender.com).
// Cloudflare widget hostnames must include: localhost, 127.0.0.1, janynda.onrender.com
export const TURNSTILE_SITE_KEY =
  import.meta.env.VITE_TURNSTILE_SITE_KEY || "0x4AAAAAADj_iE0yMQFExt6Y";

export const TURNSTILE_ENABLED = Boolean(TURNSTILE_SITE_KEY);
