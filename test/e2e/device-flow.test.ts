import { beforeEach, describe, expect, it } from "bun:test";
import { app } from "../../src/app";
import { db } from "../../src/database/db";

describe("E2E: Smart TV Device Authorization Flow (RFC 8628)", () => {
  beforeEach(() => {
    db.run("DELETE FROM device_codes");
    db.run("DELETE FROM magic_link_tokens");
    db.run("DELETE FROM refresh_tokens");
    db.run("DELETE FROM users");
  });

  it("should complete the full Smart TV login flow without keyboard input", async () => {
    // 1. TV requests code pair
    const codeReq = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/oauth/device/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(codeReq.status).toBe(200);
    const { deviceCode, userCode, verificationUri } = (await codeReq.json()) as any;
    expect(deviceCode).toBeDefined();
    expect(userCode).toBeDefined();
    expect(verificationUri).toBeDefined();

    // 2. TV polls while user has not yet authorized
    const pendingPoll = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/oauth/device/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceCode }),
      }),
    );
    expect(pendingPoll.status).toBe(400);
    const pendingData = (await pendingPoll.json()) as any;
    expect(pendingData.error).toBe("AUTHORIZATION_PENDING");

    // 3. User logs in on their phone via Magic Link first
    const magicReq = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "phoneuser@example.com" }),
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
    const phoneUser = (await verifyReq.json()) as any;
    const userId = phoneUser.user.id;

    // 4. User enters code on their phone to authorize TV
    const authReq = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/oauth/device/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCode, userId }),
      }),
    );
    expect(authReq.status).toBe(200);
    const authData = (await authReq.json()) as any;
    expect(authData.success).toBe(true);

    // 5. TV polls next time -> Successfully receives tokens!
    const successPoll = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/oauth/device/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceCode }),
      }),
    );
    expect(successPoll.status).toBe(200);
    const tvAuth = (await successPoll.json()) as any;
    expect(tvAuth.accessToken).toBeDefined();
    expect(tvAuth.refreshToken).toBeDefined();
    expect(tvAuth.user.email).toBe("phoneuser@example.com");
  });
});
