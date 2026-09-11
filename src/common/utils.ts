import * as crypto from "node:crypto";

/**
 * Hash a token using SHA-256 before storing in database
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a cryptographically secure random string
 */
export function generateSecureToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Generate an 8-character user code for Device Flow (RFC 8628), e.g. "WDJB-MJHT"
 */
export function generateUserCode(): string {
  const charset = "BCDFGHJKLMNPQRSTVWXYZ23456789";
  let code = "";
  const randomBytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += charset[randomBytes[i] % charset.length];
    if (i === 3) code += "-";
  }
  return code;
}

/**
 * Verify PKCE code_verifier against code_challenge using S256 (RFC 7636)
 */
export function verifyPkce(
  codeVerifier: string,
  codeChallenge: string,
  method: string = "S256",
): boolean {
  if (method === "plain") {
    return codeVerifier === codeChallenge;
  }
  if (method === "S256") {
    const computedChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
    return computedChallenge === codeChallenge;
  }
  return false;
}
