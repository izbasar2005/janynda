const PRODUCTION_SITE_KEY =
  import.meta.env.VITE_TURNSTILE_SITE_KEY || "0x4AAAAAADj_iE0yMQFExt6Y";

// Cloudflare test key for local/dev hosts.
const LOCAL_TEST_SITE_KEY = "1x00000000000000000000AA";

function isDevHost() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") return true;
  // Local network dev (e.g. 192.168.x.x from Vite "Network" URL).
  return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);
}

export const TURNSTILE_SITE_KEY = isDevHost()
  ? LOCAL_TEST_SITE_KEY
  : PRODUCTION_SITE_KEY;

export const TURNSTILE_ENABLED = Boolean(TURNSTILE_SITE_KEY);
