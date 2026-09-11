import type { Database } from "bun:sqlite";
import type { RefreshTokenRecord } from "../../../core/models";
import type { IRefreshTokenRepository } from "../../../core/ports/token.repository";

export class SqliteRefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private db: Database) {}

  async create(data: RefreshTokenRecord): Promise<void> {
    this.db
      .query(
        `INSERT INTO refresh_tokens (
          id, user_id, token_hash, family_id, is_revoked, 
          device_info, expires_at, created_at, last_used_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        data.id,
        data.user_id,
        data.token_hash,
        data.family_id,
        data.is_revoked,
        data.device_info,
        data.expires_at,
        data.created_at,
        data.last_used_at,
      );
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return (
      (this.db
        .query("SELECT * FROM refresh_tokens WHERE token_hash = ?")
        .get(tokenHash) as RefreshTokenRecord | null) || null
    );
  }

  async rotate(
    oldHash: string,
    newRecord: RefreshTokenRecord,
    now: number,
  ): Promise<{ success: boolean; isReused: boolean; record?: RefreshTokenRecord }> {
    const existing = await this.findByHash(oldHash);
    if (!existing) {
      return { success: false, isReused: false };
    }

    // Reuse Detection: Nếu token cũ đã bị thu hồi trước đó
    if (existing.is_revoked === 1) {
      await this.revokeFamily(existing.family_id);
      return { success: false, isReused: true };
    }

    // Token hết hạn
    if (existing.expires_at <= now) {
      return { success: false, isReused: false };
    }

    let isReusedDetected = false;

    const tx = this.db.transaction(() => {
      // Đánh dấu thu hồi token cũ nguyên tử (chỉ thành công nếu is_revoked đang là 0)
      const updateResult = this.db
        .query(
          `UPDATE refresh_tokens 
           SET is_revoked = 1, last_used_at = ? 
           WHERE id = ? AND is_revoked = 0`,
        )
        .run(now, existing.id);

      if (updateResult.changes === 0) {
        // Race condition: token vừa bị một request song song khác đổi
        isReusedDetected = true;
        this.db
          .query("UPDATE refresh_tokens SET is_revoked = 1 WHERE family_id = ?")
          .run(existing.family_id);
        return;
      }

      // Lưu token mới cùng family_id
      this.db
        .query(
          `INSERT INTO refresh_tokens (
            id, user_id, token_hash, family_id, is_revoked, 
            device_info, expires_at, created_at, last_used_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          newRecord.id,
          newRecord.user_id,
          newRecord.token_hash,
          newRecord.family_id,
          newRecord.is_revoked,
          newRecord.device_info,
          newRecord.expires_at,
          newRecord.created_at,
          newRecord.last_used_at,
        );
    });

    tx();

    if (isReusedDetected) {
      return { success: false, isReused: true };
    }

    return { success: true, isReused: false, record: existing };
  }

  async revokeByHash(tokenHash: string): Promise<void> {
    this.db.query("UPDATE refresh_tokens SET is_revoked = 1 WHERE token_hash = ?").run(tokenHash);
  }

  async revokeFamily(familyId: string): Promise<void> {
    this.db.query("UPDATE refresh_tokens SET is_revoked = 1 WHERE family_id = ?").run(familyId);
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    this.db.query("UPDATE refresh_tokens SET is_revoked = 1 WHERE user_id = ?").run(userId);
  }

  async getActiveSessions(userId: string, now: number): Promise<RefreshTokenRecord[]> {
    return this.db
      .query(
        `SELECT * FROM refresh_tokens 
         WHERE user_id = ? AND is_revoked = 0 AND expires_at > ? 
         ORDER BY last_used_at DESC`,
      )
      .all(userId, now) as RefreshTokenRecord[];
  }

  async revokeUserSession(userId: string, targetId: string): Promise<boolean> {
    const session = this.db
      .query(
        `SELECT family_id FROM refresh_tokens
         WHERE user_id = ? AND (id = ? OR family_id = ?)`,
      )
      .get(userId, targetId, targetId) as { family_id: string } | null;

    if (!session) {
      return false;
    }

    this.db
      .query(
        `UPDATE refresh_tokens SET is_revoked = 1
         WHERE user_id = ? AND family_id = ?`,
      )
      .run(userId, session.family_id);

    return true;
  }

  async revokeAllOtherSessions(userId: string, currentFamilyId?: string): Promise<void> {
    if (currentFamilyId) {
      this.db
        .query(
          `UPDATE refresh_tokens SET is_revoked = 1
           WHERE user_id = ? AND family_id != ?`,
        )
        .run(userId, currentFamilyId);
    } else {
      this.db
        .query(
          `UPDATE refresh_tokens SET is_revoked = 1
           WHERE user_id = ?`,
        )
        .run(userId);
    }
  }
}
