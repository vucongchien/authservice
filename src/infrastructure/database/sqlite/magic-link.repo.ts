import type { Database } from "bun:sqlite";
import type { MagicLinkTokenRecord } from "../../../core/models";
import type { IMagicLinkRepository } from "../../../core/ports/magic-link.repository";

export class SqliteMagicLinkRepository implements IMagicLinkRepository {
  constructor(private db: Database) {}

  async create(data: {
    id: string;
    email: string;
    token_hash: string;
    expires_at: number;
    created_at: number;
  }): Promise<void> {
    this.db
      .query(
        `INSERT INTO magic_link_tokens (id, email, token_hash, expires_at, is_used, created_at)
         VALUES (?, ?, ?, ?, 0, ?)`,
      )
      .run(data.id, data.email, data.token_hash, data.expires_at, data.created_at);
  }

  async verifyAndConsume(tokenHash: string, now: number): Promise<{ email: string } | null> {
    // ATOMIC UPDATE: Chỉ cập nhật nếu token chưa bị tiêu thụ (is_used = 0) và chưa hết hạn
    const updateResult = this.db
      .query(
        `UPDATE magic_link_tokens 
         SET is_used = 1 
         WHERE token_hash = ? AND is_used = 0 AND expires_at > ?`,
      )
      .run(tokenHash, now);

    // Nếu không bản ghi nào được update (do đã dùng hoặc hết hạn), chặn ngay lập tức
    if (updateResult.changes === 0) {
      return null;
    }

    const tokenRecord = this.db
      .query("SELECT email FROM magic_link_tokens WHERE token_hash = ?")
      .get(tokenHash) as { email: string } | null;

    return tokenRecord;
  }

  async findByTokenHash(tokenHash: string): Promise<MagicLinkTokenRecord | null> {
    return (
      (this.db
        .query("SELECT * FROM magic_link_tokens WHERE token_hash = ?")
        .get(tokenHash) as MagicLinkTokenRecord | null) || null
    );
  }
}
