import type { Sql } from "postgres";
import type { MagicLinkTokenRecord } from "../../../core/models";
import type { IMagicLinkRepository } from "../../../core/ports/magic-link.repository";

export class PostgresMagicLinkRepository implements IMagicLinkRepository {
  constructor(private sql: Sql) {}

  private mapRecord(row: any): MagicLinkTokenRecord {
    return {
      id: row.id,
      email: row.email,
      token_hash: row.token_hash,
      expires_at: Number(row.expires_at),
      is_used: Number(row.is_used),
      created_at: Number(row.created_at),
    };
  }

  async create(data: {
    id: string;
    email: string;
    token_hash: string;
    expires_at: number;
    created_at: number;
  }): Promise<void> {
    await this.sql`
      INSERT INTO magic_link_tokens (id, email, token_hash, expires_at, is_used, created_at)
      VALUES (${data.id}, ${data.email}, ${data.token_hash}, ${data.expires_at}, 0, ${data.created_at})
    `;
  }

  async verifyAndConsume(tokenHash: string, now: number): Promise<{ email: string } | null> {
    // ATOMIC CONDITIONAL UPDATE trên Postgres:
    // Chỉ có request đầu tiên thỏa mãn is_used = 0 mới cập nhật và RETURN email
    const rows = await this.sql`
      UPDATE magic_link_tokens
      SET is_used = 1
      WHERE token_hash = ${tokenHash} AND is_used = 0 AND expires_at > ${now}
      RETURNING email
    `;

    if (rows.length === 0) {
      return null;
    }

    return { email: rows[0].email };
  }

  async findByTokenHash(tokenHash: string): Promise<MagicLinkTokenRecord | null> {
    const rows = await this.sql`
      SELECT id, email, token_hash, expires_at, is_used, created_at
      FROM magic_link_tokens
      WHERE token_hash = ${tokenHash}
      LIMIT 1
    `;
    return rows.length > 0 ? this.mapRecord(rows[0]) : null;
  }
}
