import type { OAuthAccountRecord, UserRecord } from "../models";

export interface IOAuthRepository {
  find(provider: string, providerUserId: string): Promise<OAuthAccountRecord | null>;

  findByUserId(userId: string): Promise<OAuthAccountRecord[]>;

  link(data: {
    id: string;
    userId: string;
    provider: string;
    providerUserId: string;
    createdAt: number;
  }): Promise<void>;

  /**
   * Atomic Idempotent Account Linking:
   * Tìm user theo email. Nếu chưa có -> tạo mới.
   * Ghép nối bản ghi provider_user_id vào user_id trong 1 transaction an toàn chống race condition.
   */
  upsertOAuthUser(params: {
    provider: string;
    providerUserId: string;
    email: string;
    newUserId: string;
    oauthLinkId: string;
    now: number;
  }): Promise<{ user: UserRecord; isNewUser: boolean }>;
}
