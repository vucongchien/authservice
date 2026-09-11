import * as crypto from "node:crypto";
import * as jose from "jose";

export interface KeyManager {
  privateKey: crypto.KeyObject;
  publicKey: crypto.KeyObject;
  kid: string;
  jwks: { keys: jose.JWK[] };
  signJwt(payload: Record<string, any>, options?: { expiresIn?: string | number }): Promise<string>;
  verifyJwt<T = Record<string, any>>(token: string): Promise<T>;
}

let instance: KeyManager | null = null;

export async function getKeyManager(): Promise<KeyManager> {
  if (instance) return instance;

  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  const privKeyObj = crypto.createPrivateKey(privateKey);
  const pubKeyObj = crypto.createPublicKey(publicKey);

  const kid = crypto.createHash("sha256").update(publicKey).digest("hex").substring(0, 16);

  const publicJwk = await jose.exportJWK(pubKeyObj);
  publicJwk.kid = kid;
  publicJwk.use = "sig";
  publicJwk.alg = "RS256";

  const jwks = {
    keys: [publicJwk],
  };

  instance = {
    privateKey: privKeyObj,
    publicKey: pubKeyObj,
    kid,
    jwks,
    async signJwt(payload: Record<string, any>, options = {}) {
      const jwt = new jose.SignJWT(payload)
        .setProtectedHeader({ alg: "RS256", kid })
        .setIssuedAt()
        .setIssuer("authservice")
        .setAudience("authservice-clients");

      if (options.expiresIn) {
        jwt.setExpirationTime(
          typeof options.expiresIn === "number" ? `${options.expiresIn}s` : options.expiresIn,
        );
      } else {
        jwt.setExpirationTime("15m");
      }

      return await jwt.sign(privKeyObj);
    },
    async verifyJwt<T = Record<string, any>>(token: string): Promise<T> {
      const { payload } = await jose.jwtVerify(token, pubKeyObj, {
        issuer: "authservice",
        audience: "authservice-clients",
      });
      return payload as T;
    },
  };

  return instance;
}
