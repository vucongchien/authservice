import type { Sql } from "postgres";
import type { OAuthAccountRecord, UserRecord } from "../../../core/models";
import type { IOAuthRepository } from "../../../core/ports/oauth.repository";

export class PostgresOAuthRepository implements IOAuthRepository {
  constructor(private sql: Sql) {}

  private mapOAuth(row: any): OAuthAccountRecord {
    return {
      id: row.id,
      user_id: row.user_id,
      provider: row.provider,
      provider_user_id: row.provider_user_id,
      created_at: Number(row.created_at),
    };
  }

  private mapUser(row: any): UserRecord {
    return {
      id: row.id,
      email: row.email,
      is_active: Number(row.is_active),
      roles: typeof row.roles === "string" ? row.roles : JSON.stringify(row.roles),
      created_at: Number(row.created_at),
      updated_at: Number(row.updated_at),
    };
  }

  async find(provider: string, providerUserId: string): Promise<OAuthAccountRecord | null> {
    const rows = await this.sql`
      SELECT * FROM oauth_accounts 
      WHERE provider = ${provider} AND provider_user_id = ${providerUserId}
      LIMIT 1
    `;
    return rows.length > 0 ? this.mapOAuth(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<OAuthAccountRecord[]> {
    const rows = await this.sql`
      SELECT * FROM oauth_accounts WHERE user_id = ${userId}
    `;
    return rows.map((r) => this.mapOAuth(r));
  }

  async link(data: {
    id: string;
    userId: string;
    provider: string;
    providerUserId: string;
    createdAt: number;
  }): Promise<void> {
    await this.sql`
      INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, created_at)
      VALUES (${data.id}, ${data.userId}, ${data.provider}, ${data.providerUserId}, ${data.createdAt})
    `;
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

    await this.sql.begin(async (sql) => {
      // 1. Kiểm tra liên kết OAuth đã có chưa
      const oauthRows = await sql`
        SELECT * FROM oauth_accounts 
        WHERE provider = ${params.provider} AND provider_user_id = ${params.providerUserId}
        LIMIT 1
      `;

      if (oauthRows.length > 0) {
        const userRows = await sql`
          SELECT * FROM users WHERE id = ${oauthRows[0].user_id} LIMIT 1
        `;
        resultUser = this.mapUser(userRows[0]);
        isNewUser = false;
        return;
      }

      // 2. Kiểm tra email đã có trong users chưa
      const userRows = await sql`
        SELECT * FROM users WHERE email = ${params.email} LIMIT 1
      `;

      if (userRows.length === 0) {
        const defaultRoles = JSON.stringify(["user"]);
        const insertedUser = await sql`
          INSERT INTO users (id, email, is_active, roles, created_at, updated_at)
          VALUES (${params.newUserId}, ${params.email}, 1, ${defaultRoles}, ${params.now}, ${params.now})
          RETURNING *
        `;
        resultUser = this.mapUser(insertedUser[0]);
        isNewUser = true;
      } else {
        resultUser = this.mapUser(userRows[0]);
        isNewUser = false;
      }

      // 3. Tạo bản ghi OAuth
      await sql`
        INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, created_at)
        VALUES (${params.oauthLinkId}, ${resultUser.id}, ${params.provider}, ${params.providerUserId}, ${params.now})
      `;
    });

    if (!resultUser) {
      throw new Error("Failed to upsert OAuth user in PostgreSQL transaction");
    }

    return { user: resultUser, isNewUser };
  }
}
