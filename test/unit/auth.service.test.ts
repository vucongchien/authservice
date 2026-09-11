import { beforeEach, describe, expect, it } from "bun:test";
import { db } from "../../src/database/db";
import { AuthService } from "../../src/modules/auth/service";

describe("AuthService Unit Tests", () => {
  beforeEach(() => {
    db.run("DELETE FROM magic_link_tokens");
    db.run("DELETE FROM refresh_tokens");
    db.run("DELETE FROM oauth_accounts");
    db.run("DELETE FROM users");
  });

  it("should request magic link with anti-enumeration message and save token", async () => {
    const email = "user@test.com";
    const res = await AuthService.requestMagicLink(email);

    expect(res.message).toBeDefined();
    expect(res.debugToken).toBeDefined();

    // Check DB
    const row = db.query("SELECT * FROM magic_link_tokens WHERE email = ?").get(email) as any;
    expect(row).toBeDefined();
    expect(row.is_used).toBe(0);
  });

  it("should verify valid magic link, auto-register new user, and issue tokens", async () => {
    const email = "newuser@test.com";
    const requestRes = await AuthService.requestMagicLink(email);
    const token = requestRes.debugToken!;

    const verifyRes = (await AuthService.verifyMagicLink(token)) as any;
    expect(verifyRes.accessToken).toBeDefined();
    expect(verifyRes.refreshToken).toBeDefined();
    expect(verifyRes.isNewUser).toBe(true);
    expect(verifyRes.user.email).toBe(email);
    expect(verifyRes.user.roles).toEqual(["user"]);

    // Verify user created in DB
    const userInDb = db.query("SELECT * FROM users WHERE email = ?").get(email) as any;
    expect(userInDb).toBeDefined();

    // Verify token is now marked as used (single use)
    const tokenInDb = db.query("SELECT * FROM magic_link_tokens WHERE email = ?").get(email) as any;
    expect(tokenInDb.is_used).toBe(1);

    // Verify second attempt with same token fails
    const secondAttempt = (await AuthService.verifyMagicLink(token)) as any;
    expect(secondAttempt.code).toBe(400);
  });

  it("should rotate refresh token and handle reuse detection", async () => {
    const email = "rotate@test.com";
    const requestRes = await AuthService.requestMagicLink(email);
    const loginRes = (await AuthService.verifyMagicLink(requestRes.debugToken!)) as any;

    const rt1 = loginRes.refreshToken;

    // First rotation: RT1 -> RT2
    const rotate1 = (await AuthService.refreshToken(rt1)) as any;
    expect(rotate1.accessToken).toBeDefined();
    expect(rotate1.refreshToken).toBeDefined();
    expect(rotate1.refreshToken).not.toBe(rt1);

    const rt2 = rotate1.refreshToken;

    // Second rotation: RT2 -> RT3
    const rotate2 = (await AuthService.refreshToken(rt2)) as any;
    expect(rotate2.accessToken).toBeDefined();
    expect(rotate2.refreshToken).toBeDefined();

    const rt3 = rotate2.refreshToken;

    // REUSE DETECTION: Attacker tries to use RT1 (which is already rotated/revoked)
    const attackWithRt1 = (await AuthService.refreshToken(rt1)) as any;
    expect(attackWithRt1.code).toBe(401);
    expect(attackWithRt1.response.error).toBe("TOKEN_REUSE_DETECTED");

    // Entire family should now be revoked! Legitimate user with RT3 should also be revoked!
    const legitUserWithRt3 = (await AuthService.refreshToken(rt3)) as any;
    expect(legitUserWithRt3.code).toBe(401);
    expect(legitUserWithRt3.response.error).toBe("TOKEN_REUSE_DETECTED");
  });
});
