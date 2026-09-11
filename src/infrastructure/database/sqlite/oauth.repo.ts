import type { Database } from "bun:sqlite";
import type { OAuthAccountRecord, UserRecord } from "../../../core/models";
import type { IOAuthRepository } from "../../../core/ports/oauth.repository";

export class SqliteOAuthRepository implements IOAuthRepository {
  constructor(private db: Database) {}

  async find(provider: string, providerUserId: string): Promise<OAuthAccountRecord | null> {
    return (
      (this.db
        .query("SELECT * FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?")
        .get(provider, providerUserId) as OAuthAccountRecord | null) || null
    );
  }

  async findByUserId(userId: string): Promise<OAuthAccountRecord[]> {
    return this.db
      .query("SELECT * FROM oauth_accounts WHERE user_id = ?")
      .all(userId) as OAuthAccountRecord[];
  }

  async link(data: {
    id: string;
    userId: string;
    provider: string;
    providerUserId: string;
    createdAt: number;
  }): Promise<void> {
    this.db
      .query(
        `INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(data.id, data.userId, data.provider, data.providerUserId, data.createdAt);
  }

  async upsertOAuthUser(params: {
    provider: string;
    providerUserId: string;
    email: string;
    newUserId: string;
    oauthLinkId: string;
    now: number;
  }): Promise<{ user: UserRecord; isNewUser: boolean }> {
    let resultUser: UserRecord | null = null;
    let isNewUser = false;

    const tx = this.db.transaction(() => {
      // 1. Kiểm tra liên kết OAuth đã tồn tại chưa
      const existingOAuth = this.db
        .query("SELECT * FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?")
        .get(params.provider, params.providerUserId) as OAuthAccountRecord | null;

      if (existingOAuth) {
        resultUser = this.db
          .query("SELECT * FROM users WHERE id = ?")
          .get(existingOAuth.user_id) as UserRecord | null;
        isNewUser = false;
        return;
      }

      // 2. Kiểm tra xem email đã tồn tại trong bảng users chưa (Account Linking)
      let user = this.db
        .query("SELECT * FROM users WHERE email = ?")
        .get(params.email) as UserRecord | null;

      if (!user) {
        // Tạo user mới
        this.db
          .query(
            `INSERT INTO users (id, email, is_active, roles, created_at, updated_at) 
             VALUES (?, ?, 1, '["user"]', ?, ?)`,
          )
          .run(params.newUserId, params.email, params.now, params.now);

        user = {
          id: params.newUserId,
          email: params.email,
          is_active: 1,
          roles: JSON.stringify(["user"]),
          created_at: params.now,
          updated_at: params.now,
        };
        isNewUser = true;
      } else {
        isNewUser = false;
      }

      // 3. Tạo bản ghi liên kết OAuth
      this.db
        .query(
          `INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(params.oauthLinkId, user.id, params.provider, params.providerUserId, params.now);

      resultUser = user;
    });

    tx();

    if (!resultUser) {
      throw new Error("Failed to upsert OAuth user in transaction");
    }

    return { user: resultUser, isNewUser };
  }
}
