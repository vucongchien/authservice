import { beforeEach, describe, expect, it } from "bun:test";
import { app } from "../../src/app";
import { db } from "../../src/database/db";

describe("E2E: Magic Link Authentication Flow", () => {
  beforeEach(() => {
    db.run("DELETE FROM magic_link_tokens");
    db.run("DELETE FROM refresh_tokens");
    db.run("DELETE FROM users");
  });

  it("should complete the full passwordless flow: request -> verify -> issue tokens", async () => {
    const email = "e2e-magic@example.com";

    // 1. Request magic link
    const reqResponse = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }),
    );

    expect(reqResponse.status).toBe(200);
    const reqData = (await reqResponse.json()) as any;
    expect(reqData.message).toBeDefined();
    expect(reqData.debugToken).toBeDefined();

    const rawToken = reqData.debugToken;

    // 2. Verify magic link via POST
    const verifyResponse = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/magic-link/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 Test Browser" },
        body: JSON.stringify({ token: rawToken }),
      }),
    );

    expect(verifyResponse.status).toBe(200);
    const verifyData = (await verifyResponse.json()) as any;
    expect(verifyData.accessToken).toBeDefined();
    expect(verifyData.refreshToken).toBeDefined();
    expect(verifyData.isNewUser).toBe(true);
    expect(verifyData.user.email).toBe(email);
    expect(verifyData.user.roles).toEqual(["user"]);

    // 3. Trying to verify the same token again must fail (Single-use)
    const replayResponse = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/magic-link/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: rawToken }),
      }),
    );

    expect(replayResponse.status).toBe(400);
    const replayData = (await replayResponse.json()) as any;
    expect(replayData.error).toBe("INVALID_OR_EXPIRED_TOKEN");
  });

  it("should reject invalid or non-existent tokens", async () => {
    const res = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/magic-link/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "invalid_random_token_12345" }),
      }),
    );

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error).toBe("INVALID_OR_EXPIRED_TOKEN");
  });
});
