import type { NextRequest } from "next/server";

/**
 * The public origin the visitor actually used. Behind a host or reverse
 * proxy, request.nextUrl.origin can be the internal address (often
 * http://localhost:3000), so prefer an explicit setting, then the
 * forwarded headers the proxy adds.
 */
export function siteOrigin(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  if (host) {
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? "https";
    return `${proto}://${host}`;
  }
  return request.nextUrl.origin;
}
