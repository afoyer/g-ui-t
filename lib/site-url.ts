import type { NextRequest } from "next/server";

/**
 * The public origin the visitor actually used. Behind a host or reverse
 * proxy, request.nextUrl.origin can be the internal address (often
 * http://localhost:3000), so prefer an explicit setting, then the
 * forwarded headers the proxy adds. Never throws: a malformed setting
 * falls through to the next option instead of breaking every redirect.
 */
export function siteOrigin(request: NextRequest) {
  const configured = toOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) return configured;
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  if (host) {
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || "https";
    const forwarded = toOrigin(`${proto}://${host}`);
    if (forwarded) return forwarded;
  }
  return request.nextUrl.origin;
}

/** "g-ui-t.vercel.app/", "https://g-ui-t.vercel.app/x" → "https://g-ui-t.vercel.app" */
export function toOrigin(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `${/^(localhost|127\.)/.test(raw) ? "http" : "https"}://${raw}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}
