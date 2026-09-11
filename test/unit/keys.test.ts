import { describe, expect, it } from "bun:test";
import { getKeyManager } from "../../src/config/keys";

describe("KeyManager Unit Tests", () => {
  it("should initialize RSA-2048 keypair and export JWKS", async () => {
    const keyManager = await getKeyManager();

    expect(keyManager.kid).toBeDefined();
    expect(keyManager.jwks).toBeDefined();
    expect(keyManager.jwks.keys.length).toBeGreaterThanOrEqual(1);

    const jwk = keyManager.jwks.keys[0];
    expect(jwk.kty).toBe("RSA");
    expect(jwk.use).toBe("sig");
    expect(jwk.alg).toBe("RS256");
    expect(jwk.kid).toBe(keyManager.kid);
    expect(jwk.n).toBeDefined();
    expect(jwk.e).toBeDefined();
  });

  it("should sign and verify JWT using RS256", async () => {
    const keyManager = await getKeyManager();
    const payload = {
      sub: "user_12345",
      email: "test@example.com",
      roles: ["admin", "user"],
    };

    const token = await keyManager.signJwt(payload, { expiresIn: "10m" });
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);

    const verified = await keyManager.verifyJwt<typeof payload>(token);
    expect(verified.sub).toBe(payload.sub);
    expect(verified.email).toBe(payload.email);
    expect(verified.roles).toEqual(payload.roles);
  });
});
