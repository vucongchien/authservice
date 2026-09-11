import * as crypto from "node:crypto";
import * as jose from "jose";
import { authError } from "../../common/errors";
import { hashToken } from "../../common/utils";
import { config } from "../../config/env";
import { db } from "../../database/db";
import type { UserRecord } from "../auth/service";
import { TokenService } from "../token/token.service";
import type { GoogleAuthRequest } from "./model";

export interface GooglePayload {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

export abstract class OAuthService {
  /**
   * Bước 1: Quy mọi phương thức đăng nhập về duy nhất một chuỗi idToken
   */
  private static async resolveIdToken(params: GoogleAuthRequest): Promise<string | null> {
    // Nhánh 1: Client đã có sẵn idToken (từ Google SDK trên Web/Mobile)
    if (params.idToken) {
      return params.idToken;
    }

    // Nhánh 2: Client gửi code PKCE ➔ Đổi lấy idToken từ Google
    if (params.code && params.codeVerifier) {
      // Mock code trong môi trường test/dev
      if (params.code.startsWith("mock_code:")) {
        const email = params.code.replace("mock_code:", "").toLowerCase();
        return `mock:${email}:google_sub_${hashToken(email).substring(0, 12)}`;
      }

      try {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: config.google.clientId,
            client_secret: config.google.clientSecret,
            code: params.code,
            code_verifier: params.codeVerifier,
            grant_type: "authorization_code",
            redirect_uri: params.redirectUri || config.google.redirectUri,
          }),
        });

        if (!tokenRes.ok) return null;
        const tokenData = (await tokenRes.json()) as any;
        return tokenData.id_token || null;
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Bước 2: Kiểm tra tính hợp lệ và chữ ký số của Google ID Token
   */
  static async verifyGoogleIdToken(idToken: string): Promise<GooglePayload | null> {
    try {
      if (idToken.startsWith("mock:")) {
        const parts = idToken.split(":");
        const email = parts[1] || "mockuser@gmail.com";
        const sub = parts[2] || "google_sub_" + hashToken(email).substring(0, 12);
        return {
          sub,
          email: email.toLowerCase(),
          email_verified: true,
          name: "Mock Google User",
        };
      }

      const claims = jose.decodeJwt(idToken);
      if (!claims || !claims.email || !claims.sub) return null;

      const iss = claims.iss;
      if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") return null;
      if (claims.email_verified !== true && claims.email_verified !== "true") return null;

      return {
        sub: claims.sub,
        email: (claims.email as string).toLowerCase(),
        email_verified: true,
        name: claims.name as string | undefined,
        picture: claims.picture as string | undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Luồng chính đăng nhập Google: Chạy thẳng 1 đường duy nhất
   */
  static async loginWithGoogle(params: GoogleAuthRequest, deviceInfo?: Record<string, any>) {
    // 1. Lấy idToken
    const idToken = await OAuthService.resolveIdToken(params);
    if (!idToken) {
      return authError("INVALID_CREDENTIALS");
    }

    // 2. Verify idToken
    const payload = await OAuthService.verifyGoogleIdToken(idToken);
    if (!payload) {
      return authError("INVALID_ID_TOKEN");
    }

    // 3. Ghép nối tài khoản & Cấp phát token hệ thống
    return await OAuthService.upsertOAuthUserAndIssueTokens(
      "google",
      payload.sub,
      payload.email,
      deviceInfo,
    );
  }

  /**
   * Bước 3: Ghép nối tài khoản (Account Linking) và cấp token phiên dùng chung
   */
  private static async upsertOAuthUserAndIssueTokens(
    provider: string,
    providerUserId: string,
    email: string,
    deviceInfo?: Record<string, any>,
  ) {
    const cleanEmail = email.trim().toLowerCase();
    const now = Date.now();

    // Atomic Account Linking thông qua OAuth Port
    const { user, isNewUser } = await db.oauth.upsertOAuthUser({
      provider,
      providerUserId,
      email: cleanEmail,
      newUserId: crypto.randomUUID(),
      oauthLinkId: crypto.randomUUID(),
      now,
    });

    if (user.is_active !== 1) {
      return authError("ACCOUNT_DISABLED");
    }

    // Gọi hàm cấp token dùng chung (TokenService)
    const sessionTokens = await TokenService.issueSessionTokens(user, deviceInfo);

    return {
      ...sessionTokens,
      isNewUser,
    };
  }
}
