import * as crypto from "node:crypto";
import { generateSecureToken, hashToken } from "../../common/utils";
import { config } from "../../config/env";
import { getKeyManager } from "../../config/keys";
import { db } from "../../database/db";
import type { UserRecord } from "../auth/service";

export interface SessionTokenResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    roles: string[];
  };
}

export abstract class TokenService {
  /**
   * Cấp phát cặp Access Token (RS256) và Refresh Token (Opaque Hash)
   * Tái sử dụng chung cho Magic Link, Google OAuth, Smart TV và Token Rotation
   */
  static async issueSessionTokens(
    user: UserRecord,
    deviceInfo?: Record<string, any>,
    existingFamilyId?: string,
  ): Promise<SessionTokenResult> {
    const now = Date.now();
    const familyId = existingFamilyId || crypto.randomUUID();
    const rawRefreshToken = generateSecureToken(32);
    const refreshTokenHash = hashToken(rawRefreshToken);
    const refreshExpiresAt = now + config.jwt.refreshTokenTtlDays * 24 * 60 * 60 * 1000;

    // Lưu hash Refresh Token vào Database thông qua Token Port
    await db.tokens.create({
      id: crypto.randomUUID(),
      user_id: user.id,
      token_hash: refreshTokenHash,
      family_id: familyId,
      is_revoked: 0,
      device_info: deviceInfo ? JSON.stringify(deviceInfo) : null,
      expires_at: refreshExpiresAt,
      created_at: now,
      last_used_at: now,
    });

    // Ký Access Token RS256
    const keyManager = await getKeyManager();
    const userRoles = JSON.parse(user.roles || '["user"]');
    const accessToken = await keyManager.signJwt(
      {
        sub: user.id,
        email: user.email,
        roles: userRoles,
        familyId,
      },
      { expiresIn: config.jwt.accessTokenTtlSeconds },
    );

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        roles: userRoles,
      },
    };
  }
}
