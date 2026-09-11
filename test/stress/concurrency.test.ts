import { beforeEach, describe, expect, it } from "bun:test";
import { generateSecureToken, hashToken } from "../../src/common/utils";
import { db } from "../../src/database/db";
import { AuthService } from "../../src/modules/auth/service";
import { OAuthService } from "../../src/modules/oauth/service";

describe("Stress & Concurrency Tests: Anti-Race Condition & DB Transactions", () => {
  beforeEach(() => {
    db.run("DELETE FROM refresh_tokens;");
    db.run("DELETE FROM oauth_accounts;");
    db.run("DELETE FROM magic_link_tokens;");
    db.run("DELETE FROM users;");
    db.run("DELETE FROM device_codes;");
  });

  it("should safely handle 100 concurrent requests on the SAME Magic Link token: Exactly 1 succeeds, 99 fail", async () => {
    // 1. Setup a single valid magic link token in DB
    const email = "concurrency-user@test.com";
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const now = Date.now();
    const tokenId = crypto.randomUUID();

    db.run(
      `INSERT INTO magic_link_tokens (id, email, token_hash, expires_at, is_used, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
      [tokenId, email, tokenHash, now + 15 * 60 * 1000, now],
    );

    // 2. Fire 100 concurrent verify requests at the exact same instant
    const CONCURRENCY_COUNT = 100;
    const verifyPromises = Array.from({ length: CONCURRENCY_COUNT }, (_, i) =>
      AuthService.verifyMagicLink(rawToken, { userAgent: `StressTest-Client-${i}` }),
    );

    const results = await Promise.all(verifyPromises);

    // 3. Tally successes and failures
    const successes = results.filter((r: any) => r && r.accessToken && r.refreshToken);
    const failures = results.filter(
      (r: any) => r && r.code === 400 && r.response?.error === "INVALID_OR_EXPIRED_TOKEN",
    );

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(99);

    // 4. Verify Database state: Exactly 1 user created, token is marked used
    const users = db.query(`SELECT * FROM users WHERE email = ?`).all(email) as any[];
    expect(users.length).toBe(1);
    expect(users[0].email).toBe(email);

    const tokenRecord = db
      .query(`SELECT is_used FROM magic_link_tokens WHERE id = ?`)
      .get(tokenId) as any;
    expect(tokenRecord.is_used).toBe(1);
  });

  it("should trigger immediate Reuse Detection when 50 concurrent requests rotate the SAME Refresh Token", async () => {
    // 1. Register a user and issue an initial token pair
    const email = "rotation-race@test.com";
    const rawToken = generateSecureToken(32);
    db.run(
      `INSERT INTO magic_link_tokens (id, email, token_hash, expires_at, is_used, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
      [crypto.randomUUID(), email, hashToken(rawToken), Date.now() + 60000, Date.now()],
    );

    const initialAuth = (await AuthService.verifyMagicLink(rawToken)) as any;
    const originalRefreshToken = initialAuth.refreshToken;
    expect(originalRefreshToken).toBeDefined();

    // 2. Fire 50 concurrent requests trying to rotate this exact same refresh token
    const CONCURRENCY_COUNT = 50;
    const rotatePromises = Array.from({ length: CONCURRENCY_COUNT }, (_, i) =>
      AuthService.refreshToken(originalRefreshToken, { userAgent: `Racer-${i}` }),
    );

    const results = await Promise.all(rotatePromises);

    // 3. Analysis: Exactly 1 should succeed with new tokens, the rest should be caught by reuse detection
    const successes = results.filter((r: any) => r && r.accessToken && r.refreshToken);
    const reuseDetections = results.filter(
      (r: any) => r && r.code === 401 && r.response?.error === "TOKEN_REUSE_DETECTED",
    );

    expect(successes.length).toBe(1);
    expect(reuseDetections.length).toBe(49);

    // 4. Verify Database state: The family must now be completely revoked
    const activeTokensInFamily = db
      .query(`SELECT COUNT(*) as count FROM refresh_tokens WHERE is_revoked = 0`)
      .get() as any;
    // Because reuse detection revoked the entire family, active tokens should be 0 (or strictly cleaned up)
    expect(activeTokensInFamily.count).toBe(0);
  });

  it("should safely handle 50 concurrent Google Logins for the SAME email (Idempotent Account Linking)", async () => {
    const email = "concurrent-google@gmail.com";
    const googleSub = "google_sub_concurrent_12345";
    const mockIdToken = `mock:${email}:${googleSub}`;

    // 50 concurrent login requests for the same Google user
    const CONCURRENCY_COUNT = 50;
    const loginPromises = Array.from({ length: CONCURRENCY_COUNT }, (_, i) =>
      OAuthService.loginWithGoogle({ idToken: mockIdToken }, { userAgent: `GoogleClient-${i}` }),
    );

    const results = await Promise.all(loginPromises);

    // All 50 should succeed in returning tokens
    const successes = results.filter((r: any) => r && r.accessToken);
    expect(successes.length).toBe(50);

    // Exactly 1 user created
    const users = db.query(`SELECT * FROM users WHERE email = ?`).all(email) as any[];
    expect(users.length).toBe(1);

    // Exactly 1 oauth_accounts record created
    const oauthAccounts = db
      .query(`SELECT * FROM oauth_accounts WHERE provider = 'google' AND provider_user_id = ?`)
      .all(googleSub) as any[];
    expect(oauthAccounts.length).toBe(1);
    expect(oauthAccounts[0].user_id).toBe(users[0].id);
  });
});
