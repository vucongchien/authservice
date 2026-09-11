import { beforeEach, describe, expect, it } from "bun:test";
import * as jose from "jose";
import { app } from "../../src/app";
import { db } from "../../src/database/db";

describe("E2E: Decentralized Verification via JWKS Endpoint", () => {
  beforeEach(() => {
    db.run("DELETE FROM magic_link_tokens");
    db.run("DELETE FROM refresh_tokens");
    db.run("DELETE FROM users");
  });

  it("should serve public keys in RFC 7517 JWKS format with cache headers", async () => {
    const res = await app.handle(new Request("http://localhost:3000/.well-known/jwks.json"));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("public");
    expect(res.headers.get("cache-control")).toContain("max-age=86400");

    const jwks = (await res.json()) as any;
    expect(jwks.keys).toBeDefined();
    expect(jwks.keys.length).toBeGreaterThanOrEqual(1);

    const key = jwks.keys[0];
    expect(key.kty).toBe("RSA");
    expect(key.use).toBe("sig");
    expect(key.alg).toBe("RS256");
    expect(key.n).toBeDefined();
    expect(key.e).toBeDefined();
  });

  it("should allow external services to verify Access Tokens locally using cached JWKS (No back-channel calls)", async () => {
    // 1. Client logs in and gets Access Token
    const loginReq = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "satellite-service@example.com" }),
      }),
    );
    const { debugToken } = (await loginReq.json()) as any;
    const verifyReq = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/magic-link/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: debugToken }),
      }),
    );
    const { accessToken } = (await verifyReq.json()) as any;

    // 2. An external business service (e.g. Order Service) fetches JWKS once and caches it
    const jwksRes = await app.handle(new Request("http://localhost:3000/.well-known/jwks.json"));
    const jwksData = (await jwksRes.json()) as any;

    const JWKS = jose.createLocalJWKSet(jwksData);

    // 3. External service verifies token purely in-memory with ZERO HTTP requests to AuthService
    const { payload } = await jose.jwtVerify(accessToken, JWKS, {
      issuer: "authservice",
      audience: "authservice-clients",
    });

    expect(payload.email).toBe("satellite-service@example.com");
    expect(payload.roles).toEqual(["user"]);
    expect(payload.sub).toBeDefined();
  });
});
