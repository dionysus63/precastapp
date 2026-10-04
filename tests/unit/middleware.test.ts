import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

function request(path: string, cookie?: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } : {},
  });
}

describe("middleware", () => {
  it("lets a stale session cookie reach the login page (no redirect loop)", () => {
    // After a password reset or deactivation the cookie outlives its
    // session; the login page decides, by checking the database.
    const response = middleware(request("/login", "dead-session-token"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("still sends cookie-less page requests to the login page", () => {
    const response = middleware(request("/jobs"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });
});
