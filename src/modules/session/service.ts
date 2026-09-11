import { AUTH_MESSAGES, authError } from "../../common/errors";
import type { RefreshTokenRecord } from "../../core/models";
import { db } from "../../database/db";

export abstract class SessionService {
  /**
   * List all active sessions for a user
   */
  static async listSessions(userId: string, currentFamilyId?: string) {
    const now = Date.now();

    // Lấy các refresh token đang active từ Token Port
    const records = await db.tokens.getActiveSessions(userId, now);

    // Deduplicate theo family_id (mỗi family đại diện cho 1 thiết bị/phiên)
    const familyMap = new Map<string, RefreshTokenRecord>();
    for (const record of records) {
      if (!familyMap.has(record.family_id)) {
        familyMap.set(record.family_id, record);
      }
    }

    return Array.from(familyMap.values()).map((r) => ({
      id: r.id,
      familyId: r.family_id,
      deviceInfo: r.device_info ? JSON.parse(r.device_info) : { type: "Unknown Device" },
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
      expiresAt: r.expires_at,
      isCurrent: currentFamilyId ? r.family_id === currentFamilyId : false,
    }));
  }

  /**
   * Revoke a specific session (by session/token id or family_id)
   */
  static async revokeSession(userId: string, targetId: string) {
    const revoked = await db.tokens.revokeUserSession(userId, targetId);

    if (!revoked) {
      return authError("SESSION_NOT_FOUND");
    }

    return { success: true, message: AUTH_MESSAGES.REVOKE_SESSION_SUCCESS };
  }

  /**
   * Revoke all other sessions (Multi-device logout)
   */
  static async revokeAllOtherSessions(userId: string, currentFamilyId?: string) {
    await db.tokens.revokeAllOtherSessions(userId, currentFamilyId);

    return { success: true, message: AUTH_MESSAGES.REVOKE_ALL_SESSIONS_SUCCESS };
  }
}
