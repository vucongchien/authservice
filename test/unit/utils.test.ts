import { describe, expect, it } from "bun:test";
import * as crypto from "node:crypto";
import {
  generateSecureToken,
  generateUserCode,
  hashToken,
  verifyPkce,
} from "../../src/common/utils";

describe("Utils Unit Tests", () => {
  it("should hash tokens deterministically using SHA-256", () => {
    const token = "my-secret-random-token";
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex is 64 chars
  });

  it("should generate secure unique tokens", () => {
    const t1 = generateSecureToken(32);
    const t2 = generateSecureToken(32);

    expect(t1).not.toBe(t2);
    expect(t1.length).toBe(64); // 32 bytes in hex = 64 chars
  });

  it("should generate valid user code with XXXX-XXXX format", () => {
    const code = generateUserCode();
    expect(code).toMatch(/^[BCDFGHJKLMNPQRSTVWXYZ23456789]{4}-[BCDFGHJKLMNPQRSTVWXYZ23456789]{4}$/);
    expect(code.length).toBe(9);
  });

  it("should verify PKCE code challenge with S256", () => {
    const codeVerifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

    expect(verifyPkce(codeVerifier, codeChallenge, "S256")).toBe(true);
    expect(verifyPkce("wrong-verifier", codeChallenge, "S256")).toBe(false);
  });
});
