// I have nothing but my burger and I want nothing more
import * as crypto from "node:crypto";
import { AUTH_MESSAGES, authError } from "../../common/errors";
import { eventBus } from "../../common/events";
import { generateSecureToken, hashToken } from "../../common/utils";
import { config } from "../../config/env";
import { getKeyManager } from "../../config/keys";
import type { RefreshTokenRecord, UserRecord } from "../../core/models";
import { db } from "../../database/db";
import { TokenService } from "../token/token.service";

// Re-export models for backward compatibility
export type { RefreshTokenRecord, UserRecord } from "../../core/models";

export abstract class AuthService {
  /**
   * Request a magic link.
   * Emits event to EventBus for decoupling.
   * Returns generic message to prevent user enumeration.
   */
  static async requestMagicLink(email: string, clientBaseUrl?: string) {
    const cleanEmail = email.trim().toLowerCase();
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const now = Date.now();
    const expiresAt = now + config.magicLink.ttlMinutes * 60 * 1000;

    // Save token to DB via MagicLink Port
    const tokenId = crypto.randomUUID();
    await db.magicLinks.create({
      id: tokenId,
      email: cleanEmail,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_at: now,
    });

    const baseUrl = clientBaseUrl || config.baseUrl;
    const actionUrl = `${baseUrl}/api/v1/auth/magic-link/verify?token=${rawToken}`;

    // Emit event for notification service / dev logger
    eventBus.emitEvent("auth.email.magic_link", {
      email: cleanEmail,
      token: rawToken,
      url: actionUrl,
      expiresAt: new Date(expiresAt),
    });

    return {
      message: AUTH_MESSAGES.MAGIC_LINK_SENT,
      ...(config.debugExposeToken ? { debugToken: rawToken } : {}),
    };
  }

  /**
   * Verify a magic link token.
   * Automatically registers user if email is new (isNewUser = true).
   * Issues JWT RS256 Access Token and initial Refresh Token via TokenService.
   */
  static async verifyMagicLink(rawToken: string, deviceInfo?: Record<string, any>) {
    const tokenHash = hashToken(rawToken);
    const now = Date.now();

    // Atomic Operation: Burn token (atomically check is_used = 0)
    const consumed = await db.magicLinks.verifyAndConsume(tokenHash, now);
    if (!consumed) {
      return authError("INVALID_OR_EXPIRED_TOKEN");
    }

    let user = await db.users.findByEmail(consumed.email);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await db.users.create({
        id: crypto.randomUUID(),
        email: consumed.email,
        roles: JSON.stringify(["user"]),
        created_at: now,
      });
    }

    if (user.is_active !== 1) {
      return authError("ACCOUNT_DISABLED");
    }

    // Issue Session Tokens via centralized TokenService
    const sessionTokens = await TokenService.issueSessionTokens(user, deviceInfo);

    return {
      ...sessionTokens,
      isNewUser,
    };
  }

  /**
   * Refresh Token with Token Rotation (RTR) and Reuse Detection.
   * If a revoked token is presented, revoke the ENTIRE token family!
   */
  static async refreshToken(rawRefreshToken: string, deviceInfo?: Record<string, any>) {
    const tokenHash = hashToken(rawRefreshToken);
    const now = Date.now();

    const rtRecord = await db.tokens.findByHash(tokenHash);
    if (!rtRecord) {
      return authError("INVALID_REFRESH_TOKEN");
    }

    // REUSE DETECTION: If token was already revoked, someone is replaying a stolen token!
    if (rtRecord.is_revoked === 1) {
      await db.tokens.revokeFamily(rtRecord.family_id);
      return authError("TOKEN_REUSE_DETECTED");
    }

    // Check expiration
    if (rtRecord.expires_at < now) {
      return authError("INVALID_REFRESH_TOKEN", "Refresh token đã hết hạn");
    }

    // Find User
    const user = await db.users.findById(rtRecord.user_id);
    if (!user || user.is_active !== 1) {
      return authError("ACCOUNT_DISABLED");
    }

    // Atomic Token Rotation via Token Port
    const rawNewRefreshToken = generateSecureToken(32);
    const newRefreshTokenHash = hashToken(rawNewRefreshToken);
    const refreshExpiresAt = now + config.jwt.refreshTokenTtlDays * 24 * 60 * 60 * 1000;

    const newRecord: RefreshTokenRecord = {
      id: crypto.randomUUID(),
      user_id: user.id,
      token_hash: newRefreshTokenHash,
      family_id: rtRecord.family_id,
      is_revoked: 0,
      device_info: deviceInfo ? JSON.stringify(deviceInfo) : null,
      expires_at: refreshExpiresAt,
      created_at: now,
      last_used_at: now,
    };

    const rotateResult = await db.tokens.rotate(tokenHash, newRecord, now);
    if (!rotateResult.success) {
      return authError("TOKEN_REUSE_DETECTED");
    }

    // Sign Access Token RS256
    const keyManager = await getKeyManager();
    const userRoles = JSON.parse(user.roles || '["user"]');
    const accessToken = await keyManager.signJwt(
      {
        sub: user.id,
        email: user.email,
        roles: userRoles,
        familyId: rtRecord.family_id,
      },
      { expiresIn: config.jwt.accessTokenTtlSeconds },
    );

    return {
      accessToken,
      refreshToken: rawNewRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        roles: userRoles,
      },
    };
  }

  /**
   * Revoke a refresh token (Logout)
   */
  static async logout(rawRefreshToken: string) {
    const tokenHash = hashToken(rawRefreshToken);
    await db.tokens.revokeByHash(tokenHash);

    return { message: AUTH_MESSAGES.LOGOUT_SUCCESS };
  }
}
