import { beforeEach, describe, expect, it } from "bun:test";
import { app } from "../../src/app";
import { db } from "../../src/database/db";

describe("E2E: Core Identity Convention (Account Linking)", () => {
  beforeEach(() => {
    db.run("DELETE FROM magic_link_tokens");
    db.run("DELETE FROM refresh_tokens");
    db.run("DELETE FROM oauth_accounts");
    db.run("DELETE FROM users");
  });

  it("should link Google OAuth account automatically when email matches existing Magic Link user", async () => {
    const email = "shared-identity@gmail.com";

    // 1. User registers via Magic Link first
    const magicReq = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }),
    );
    const { debugToken } = (await magicReq.json()) as any;

    const magicVerify = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/magic-link/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: debugToken }),
      }),
    );
    const magicUser = (await magicVerify.json()) as any;
    expect(magicUser.isNewUser).toBe(true);
    const originalUserId = magicUser.user.id;

    // 2. Later, Client calls unified Google OAuth endpoint with matching email
    const googleReq = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/oauth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: `mock:${email}:google_uid_9999` }),
      }),
    );

    expect(googleReq.status).toBe(200);
    const googleUser = (await googleReq.json()) as any;

    // 3. Must be linked to the EXACT same user_id!
    expect(googleUser.user.id).toBe(originalUserId);
    expect(googleUser.isNewUser).toBe(false);
    expect(googleUser.user.email).toBe(email);

    // 4. Verify in DB that only 1 record exists in users table for this email
    const usersInDb = db.query("SELECT * FROM users WHERE email = ?").all(email) as any[];
    expect(usersInDb.length).toBe(1);

    // 5. Verify that oauth_accounts has linked google_uid_9999 to originalUserId
    const oauthLinks = db
      .query("SELECT * FROM oauth_accounts WHERE user_id = ? AND provider = 'google'")
      .all(originalUserId) as any[];
    expect(oauthLinks.length).toBe(1);
    expect(oauthLinks[0].provider_user_id).toBe("google_uid_9999");
  });
});
