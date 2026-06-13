const PRODUCTION_SITE_KEY =
  import.meta.env.VITE_TURNSTILE_SITE_KEY || "0x4AAAAAADj_iE0yMQFExt6Y";

// Cloudflare test key for localhost dev (no dashboard hostname needed).
const LOCAL_TEST_SITE_KEY = "1x00000000000000000000AA";

function isLocalDevHost() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

export const TURNSTILE_SITE_KEY = isLocalDevHost()
  ? LOCAL_TEST_SITE_KEY
  : PRODUCTION_SITE_KEY;

export const TURNSTILE_ENABLED = Boolean(TURNSTILE_SITE_KEY);
