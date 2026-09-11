import type { RefreshTokenRecord } from "../models";

export interface IRefreshTokenRepository {
  create(data: RefreshTokenRecord): Promise<void>;

  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;

  /**
   * Atomic Token Rotation & Reuse Detection:
   * Nếu token hợp lệ: đánh dấu thu hồi token cũ và chèn token mới trong 1 transaction.
   * Nếu phát hiện token cũ đã bị thu hồi trước đó (Reused): thu hồi toàn bộ family_id và báo lỗi.
   */
  rotate(
    oldHash: string,
    newRecord: RefreshTokenRecord,
    now: number,
  ): Promise<{ success: boolean; isReused: boolean; record?: RefreshTokenRecord }>;

  revokeByHash(tokenHash: string): Promise<void>;

  revokeFamily(familyId: string): Promise<void>;

  revokeAllUserTokens(userId: string): Promise<void>;

  getActiveSessions(userId: string, now: number): Promise<RefreshTokenRecord[]>;

  revokeUserSession(userId: string, targetId: string): Promise<boolean>;

  revokeAllOtherSessions(userId: string, currentFamilyId?: string): Promise<void>;
}
