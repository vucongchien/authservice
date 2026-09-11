import { beforeEach, describe, expect, it } from "bun:test";
import { db } from "../../src/database/db";
import { AuthService } from "../../src/modules/auth/service";
import { OAuthService } from "../../src/modules/oauth/service";

describe("OAuthService & Account Linking Unit Tests", () => {
  beforeEach(() => {
    db.run("DELETE FROM magic_link_tokens");
    db.run("DELETE FROM refresh_tokens");
    db.run("DELETE FROM oauth_accounts");
    db.run("DELETE FROM users");
  });

  it("should log in with Google ID Token and auto-create user", async () => {
    const mockIdToken = "mock:googleuser@gmail.com:google_sub_12345";
    const res = (await OAuthService.loginWithGoogle({ idToken: mockIdToken })) as any;

    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();
    expect(res.isNewUser).toBe(true);
    expect(res.user.email).toBe("googleuser@gmail.com");

    // Check DB
    const userInDb = db
      .query("SELECT * FROM users WHERE email = ?")
      .get("googleuser@gmail.com") as any;
    expect(userInDb).toBeDefined();

    const oauthInDb = db
      .query("SELECT * FROM oauth_accounts WHERE provider_user_id = ?")
      .get("google_sub_12345") as any;
    expect(oauthInDb).toBeDefined();
    expect(oauthInDb.user_id).toBe(userInDb.id);
  });

  it("should log in with PKCE Code flow", async () => {
    const res = (await OAuthService.loginWithGoogle({
      code: "mock_code:pkceuser@gmail.com",
      codeVerifier: "sample_code_verifier_12345",
    })) as any;

    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();
    expect(res.user.email).toBe("pkceuser@gmail.com");
  });

  it("should strictly enforce Account Linking Convention: Magic link first, then Google OAuth -> SAME user_id", async () => {
    const email = "shared@gmail.com";

    // 1. User registers via Magic Link
    const magicReq = await AuthService.requestMagicLink(email);
    const magicLogin = (await AuthService.verifyMagicLink(magicReq.debugToken!)) as any;
    expect(magicLogin.isNewUser).toBe(true);
    const originalUserId = magicLogin.user.id;

    // 2. User later signs in using Google OAuth with the same email
    const mockGoogleToken = `mock:${email}:google_sub_shared_999`;
    const googleLogin = (await OAuthService.loginWithGoogle({ idToken: mockGoogleToken })) as any;

    // 3. Must NOT create a second user! Must return the SAME user_id!
    expect(googleLogin.user.id).toBe(originalUserId);
    expect(googleLogin.isNewUser).toBe(false);

    // Verify only 1 user exists in users table with this email
    const usersCount = db
      .query("SELECT COUNT(*) as count FROM users WHERE email = ?")
      .get(email) as any;
    expect(usersCount.count).toBe(1);

    // Verify oauth_accounts has linked google_sub_shared_999 to originalUserId
    const linkedAccount = db
      .query(
        "SELECT * FROM oauth_accounts WHERE provider = 'google' AND provider_user_id = 'google_sub_shared_999'",
      )
      .get() as any;
    expect(linkedAccount).toBeDefined();
    expect(linkedAccount.user_id).toBe(originalUserId);
  });
});
