import type { Sql } from "postgres";
import type { UserRecord } from "../../../core/models";
import type { IUserRepository } from "../../../core/ports/user.repository";

export class PostgresUserRepository implements IUserRepository {
  constructor(private sql: Sql) {}

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

  async findById(id: string): Promise<UserRecord | null> {
    const rows = await this.sql`
      SELECT id, email, is_active, roles, created_at, updated_at
      FROM users 
      WHERE id = ${id}
      LIMIT 1
    `;
    return rows.length > 0 ? this.mapUser(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const rows = await this.sql`
      SELECT id, email, is_active, roles, created_at, updated_at
      FROM users 
      WHERE email = ${email}
      LIMIT 1
    `;
    return rows.length > 0 ? this.mapUser(rows[0]) : null;
  }

  async create(data: {
    id: string;
    email: string;
    roles?: string;
    created_at?: number;
  }): Promise<UserRecord> {
    const now = data.created_at || Date.now();
    const roles = data.roles || JSON.stringify(["user"]);

    const rows = await this.sql`
      INSERT INTO users (id, email, is_active, roles, created_at, updated_at)
      VALUES (${data.id}, ${data.email}, 1, ${roles}, ${now}, ${now})
      RETURNING id, email, is_active, roles, created_at, updated_at
    `;

    return this.mapUser(rows[0]);
  }

  async updateRoles(id: string, rolesJson: string, updatedAt: number): Promise<void> {
    await this.sql`
      UPDATE users 
      SET roles = ${rolesJson}, updated_at = ${updatedAt} 
      WHERE id = ${id}
    `;
  }

  async setActive(id: string, isActive: number, updatedAt: number): Promise<void> {
    await this.sql`
      UPDATE users 
      SET is_active = ${isActive}, updated_at = ${updatedAt} 
      WHERE id = ${id}
    `;
  }
}
