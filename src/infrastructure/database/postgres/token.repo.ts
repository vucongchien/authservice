import type { Sql } from "postgres";
import type { RefreshTokenRecord } from "../../../core/models";
import type { IRefreshTokenRepository } from "../../../core/ports/token.repository";

export class PostgresRefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private sql: Sql) {}

  private mapToken(row: any): RefreshTokenRecord {
    return {
      id: row.id,
      user_id: row.user_id,
      token_hash: row.token_hash,
      family_id: row.family_id,
      is_revoked: Number(row.is_revoked),
      device_info: row.device_info,
      expires_at: Number(row.expires_at),
      created_at: Number(row.created_at),
      last_used_at: Number(row.last_used_at),
    };
  }

  async create(data: RefreshTokenRecord): Promise<void> {
    await this.sql`
      INSERT INTO refresh_tokens (
        id, user_id, token_hash, family_id, is_revoked, 
        device_info, expires_at, created_at, last_used_at
      ) VALUES (
        ${data.id}, ${data.user_id}, ${data.token_hash}, ${data.family_id}, ${data.is_revoked},
        ${data.device_info}, ${data.expires_at}, ${data.created_at}, ${data.last_used_at}
      )
    `;
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const rows = await this.sql`
      SELECT * FROM refresh_tokens 
      WHERE token_hash = ${tokenHash}
      LIMIT 1
    `;
    return rows.length > 0 ? this.mapToken(rows[0]) : null;
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

    if (existing.is_revoked === 1) {
      await this.revokeFamily(existing.family_id);
      return { success: false, isReused: true };
    }

    if (existing.expires_at <= now) {
      return { success: false, isReused: false };
    }

    let isReusedDetected = false;

    await this.sql.begin(async (sql) => {
      // Conditional update trong transaction
      const updated = await sql`
        UPDATE refresh_tokens
        SET is_revoked = 1, last_used_at = ${now}
        WHERE id = ${existing.id} AND is_revoked = 0
        RETURNING id
      `;

      if (updated.length === 0) {
        isReusedDetected = true;
        await sql`
          UPDATE refresh_tokens 
          SET is_revoked = 1 
          WHERE family_id = ${existing.family_id}
        `;
        return;
      }

      await sql`
        INSERT INTO refresh_tokens (
          id, user_id, token_hash, family_id, is_revoked, 
          device_info, expires_at, created_at, last_used_at
        ) VALUES (
          ${newRecord.id}, ${newRecord.user_id}, ${newRecord.token_hash}, ${newRecord.family_id}, ${newRecord.is_revoked},
          ${newRecord.device_info}, ${newRecord.expires_at}, ${newRecord.created_at}, ${newRecord.last_used_at}
        )
      `;
    });

    if (isReusedDetected) {
      return { success: false, isReused: true };
    }

    return { success: true, isReused: false, record: existing };
  }

  async revokeByHash(tokenHash: string): Promise<void> {
    await this.sql`
      UPDATE refresh_tokens 
      SET is_revoked = 1 
      WHERE token_hash = ${tokenHash}
    `;
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.sql`
      UPDATE refresh_tokens 
      SET is_revoked = 1 
      WHERE family_id = ${familyId}
    `;
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.sql`
      UPDATE refresh_tokens 
      SET is_revoked = 1 
      WHERE user_id = ${userId}
    `;
  }

  async getActiveSessions(userId: string, now: number): Promise<RefreshTokenRecord[]> {
    const rows = await this.sql`
      SELECT * FROM refresh_tokens
      WHERE user_id = ${userId} AND is_revoked = 0 AND expires_at > ${now}
      ORDER BY last_used_at DESC
    `;
    return rows.map((r) => this.mapToken(r));
  }

  async revokeUserSession(userId: string, targetId: string): Promise<boolean> {
    const rows = await this.sql`
      SELECT family_id FROM refresh_tokens
      WHERE user_id = ${userId} AND (id = ${targetId} OR family_id = ${targetId})
      LIMIT 1
    `;

    if (rows.length === 0) {
      return false;
    }

    await this.sql`
      UPDATE refresh_tokens 
      SET is_revoked = 1
      WHERE user_id = ${userId} AND family_id = ${rows[0].family_id}
    `;

    return true;
  }

  async revokeAllOtherSessions(userId: string, currentFamilyId?: string): Promise<void> {
    if (currentFamilyId) {
      await this.sql`
        UPDATE refresh_tokens 
        SET is_revoked = 1
        WHERE user_id = ${userId} AND family_id != ${currentFamilyId}
      `;
    } else {
      await this.sql`
        UPDATE refresh_tokens 
        SET is_revoked = 1
        WHERE user_id = ${userId}
      `;
    }
  }
}
