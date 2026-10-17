const SITE_ORIGIN = "https://omarmassfih.no";

// Backend notes and stored chat replies can still contain the former URLs.
// Convert only website links; documentation and other external URLs stay intact.
export function cleanSiteUrl(value, baseUrl = `${SITE_ORIGIN}/`) {
  if (typeof value !== "string" || !value || /^[#?]/.test(value)) return value;

  try {
    const base = new URL(baseUrl);
    const url = new URL(value, base);
    if (!/^https?:$/.test(url.protocol) ||
        (url.origin !== SITE_ORIGIN && url.origin !== base.origin)) return value;

    let pathname = url.pathname;
    if (pathname !== "/404.html") {
      pathname = pathname.replace(/\/index\.html$/, "/").replace(/\.html$/, "/");
    }

    return `${pathname}${url.search}${url.hash}`;
  } catch {
    return value;
  }
}
