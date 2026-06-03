export const NO_AVATAR =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
  <svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'>
    <rect width='100%' height='100%' fill='%23e2e8f0'/>
    <circle cx='128' cy='100' r='50' fill='%230d9488' opacity='0.35'/>
    <rect x='68' y='160' width='120' height='60' rx='30' fill='%230d9488' opacity='0.35'/>
  </svg>`);

export function normalizePhoto(url) {
    if (!url) return NO_AVATAR;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) return url;
    return "/" + url;
}
