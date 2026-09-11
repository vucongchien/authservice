import { beforeEach, describe, expect, it } from "bun:test";
import { app } from "../../src/app";
import { db } from "../../src/database/db";

describe("E2E: Session & Multi-Device Management", () => {
  beforeEach(() => {
    db.run("DELETE FROM magic_link_tokens");
    db.run("DELETE FROM refresh_tokens");
    db.run("DELETE FROM users");
  });

  it("should list sessions and allow revoking individual or all other sessions", async () => {
    const email = "multidevice@example.com";

    // 1. Login on Device 1 (Chrome on Windows)
    const req1 = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }),
    );
    const { debugToken: token1 } = (await req1.json()) as any;
    const verify1 = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/magic-link/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Chrome on Windows" },
        body: JSON.stringify({ token: token1 }),
      }),
    );
    const session1 = (await verify1.json()) as any;
    const at1 = session1.accessToken;

    // 2. Login on Device 2 (Safari on iPhone)
    const req2 = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }),
    );
    const { debugToken: token2 } = (await req2.json()) as any;
    const verify2 = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/magic-link/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Safari on iPhone" },
        body: JSON.stringify({ token: token2 }),
      }),
    );
    const session2 = (await verify2.json()) as any;
    const rt2 = session2.refreshToken;

    // 3. Login on Device 3 (Firefox on Linux)
    const req3 = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }),
    );
    const { debugToken: token3 } = (await req3.json()) as any;
    const verify3 = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/magic-link/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Firefox on Linux" },
        body: JSON.stringify({ token: token3 }),
      }),
    );
    const session3 = (await verify3.json()) as any;
    const rt3 = session3.refreshToken;

    // 4. Device 1 queries active sessions using Bearer AT1
    const listReq = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/sessions", {
        method: "GET",
        headers: { Authorization: `Bearer ${at1}` },
      }),
    );
    expect(listReq.status).toBe(200);
    const sessionsList = (await listReq.json()) as any[];
    expect(sessionsList.length).toBe(3);

    // One of them must have isCurrent = true (Device 1)
    const currentSession = sessionsList.find((s) => s.isCurrent === true);
    expect(currentSession).toBeDefined();

    // 5. Device 1 revokes Device 2 explicitly by session id
    const device2Session = sessionsList.find((s) => s.deviceInfo?.userAgent === "Safari on iPhone");
    expect(device2Session).toBeDefined();

    const revokeReq = await app.handle(
      new Request(`http://localhost:3000/api/v1/auth/sessions/${device2Session.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${at1}` },
      }),
    );
    expect(revokeReq.status).toBe(200);

    // Device 2's refresh token must now be rejected
    const d2Refresh = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/token/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rt2 }),
      }),
    );
    expect(d2Refresh.status).toBe(401);

    // 6. Device 1 revokes ALL OTHER sessions
    const revokeAllReq = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/sessions", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${at1}` },
      }),
    );
    expect(revokeAllReq.status).toBe(200);

    // Device 3's refresh token must now also be rejected
    const d3Refresh = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/token/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rt3 }),
      }),
    );
    expect(d3Refresh.status).toBe(401);
  });
});
