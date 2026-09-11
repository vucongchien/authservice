import { beforeEach, describe, expect, it } from "bun:test";
import { app } from "../../src/app";
import { db } from "../../src/database/db";

describe("E2E: Token Rotation (RTR) & Reuse Detection", () => {
  beforeEach(() => {
    db.run("DELETE FROM magic_link_tokens");
    db.run("DELETE FROM refresh_tokens");
    db.run("DELETE FROM users");
  });

  it("should rotate tokens seamlessly and detect token reuse theft", async () => {
    // 1. Initial Login via Magic Link
    const magicReq = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "rotation-e2e@example.com" }),
      }),
    );
    const { debugToken } = (await magicReq.json()) as any;

    const verifyReq = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/magic-link/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: debugToken }),
      }),
    );
    const initialAuth = (await verifyReq.json()) as any;
    const rt1 = initialAuth.refreshToken;

    // 2. Client performs 1st rotation: RT1 -> RT2
    const rotate1Req = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/token/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rt1 }),
      }),
    );
    expect(rotate1Req.status).toBe(200);
    const rotate1Data = (await rotate1Req.json()) as any;
    const rt2 = rotate1Data.refreshToken;
    expect(rt2).not.toBe(rt1);

    // 3. Client performs 2nd rotation: RT2 -> RT3
    const rotate2Req = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/token/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rt2 }),
      }),
    );
    expect(rotate2Req.status).toBe(200);
    const rotate2Data = (await rotate2Req.json()) as any;
    const rt3 = rotate2Data.refreshToken;
    expect(rt3).not.toBe(rt2);

    // 4. ATTEMPT REUSE: Hacker sends RT1 (which is already rotated)
    const attackReq = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/token/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rt1 }),
      }),
    );
    expect(attackReq.status).toBe(401);
    const attackData = (await attackReq.json()) as any;
    expect(attackData.error).toBe("TOKEN_REUSE_DETECTED");

    // 5. ENTIRE FAMILY REVOKED: Legitimate user using RT3 is now forced out
    const legitUserReq = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/token/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rt3 }),
      }),
    );
    expect(legitUserReq.status).toBe(401);
    const legitUserData = (await legitUserReq.json()) as any;
    expect(legitUserData.error).toBe("TOKEN_REUSE_DETECTED");
  });

  it("should successfully logout and invalidate refresh token", async () => {
    // Initial login
    const magicReq = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "logout-e2e@example.com" }),
      }),
    );
    const { debugToken } = (await magicReq.json()) as any;

    const verifyReq = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/magic-link/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: debugToken }),
      }),
    );
    const { refreshToken } = (await verifyReq.json()) as any;

    // Logout
    const logoutReq = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }),
    );
    expect(logoutReq.status).toBe(200);

    // Subsequent refresh with logged out token should be rejected
    const refreshReq = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/token/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }),
    );
    expect(refreshReq.status).toBe(401);
  });
});
