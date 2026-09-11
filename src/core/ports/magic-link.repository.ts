import type { MagicLinkTokenRecord } from "../models";

export interface IMagicLinkRepository {
  create(data: {
    id: string;
    email: string;
    token_hash: string;
    expires_at: number;
    created_at: number;
  }): Promise<void>;

  /**
   * Chống Race Condition: Kiểm tra và đánh dấu đã sử dụng (is_used = 1)
   * chỉ thành công khi is_used = 0 và chưa hết hạn.
   * Nếu có 100 requests đồng thời, duy nhất 1 request thành công trả về email.
   */
  verifyAndConsume(tokenHash: string, now: number): Promise<{ email: string } | null>;

  findByTokenHash(tokenHash: string): Promise<MagicLinkTokenRecord | null>;
}
