import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { siteOrigin, toOrigin } from "@/lib/site-url";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

describe("toOrigin", () => {
  it("accepts the ways people type a site URL", () => {
    expect(toOrigin("g-ui-t.vercel.app")).toBe("https://g-ui-t.vercel.app");
    expect(toOrigin(" https://g-ui-t.vercel.app/ ")).toBe("https://g-ui-t.vercel.app");
    expect(toOrigin("https://g-ui-t.vercel.app/some/path")).toBe("https://g-ui-t.vercel.app");
    expect(toOrigin("localhost:3000")).toBe("http://localhost:3000");
  });

  it("rejects junk instead of throwing", () => {
    expect(toOrigin("")).toBeNull();
    expect(toOrigin(undefined)).toBeNull();
    expect(toOrigin("https://")).toBeNull();
    expect(toOrigin("ftp://example.com")).toBeNull();
  });
});

describe("siteOrigin", () => {
  const req = (headers: Record<string, string> = {}) =>
    new NextRequest("http://localhost:3000/auth/callback", { headers });

  it("uses a bare-host setting without crashing (the Vercel 500)", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "g-ui-t.vercel.app";
    const origin = siteOrigin(req());
    expect(origin).toBe("https://g-ui-t.vercel.app");
    expect(new URL("/login", origin).href).toBe("https://g-ui-t.vercel.app/login");
  });

  it("falls back to forwarded headers, then the request", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://";
    expect(siteOrigin(req({ "x-forwarded-host": "g-ui-t.vercel.app", "x-forwarded-proto": "https" }))).toBe(
      "https://g-ui-t.vercel.app",
    );
    expect(siteOrigin(req())).toBe("http://localhost:3000");
  });
});
