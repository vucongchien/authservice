import type { Database } from "bun:sqlite";
import type { UserRecord } from "../../../core/models";
import type { IUserRepository } from "../../../core/ports/user.repository";

export class SqliteUserRepository implements IUserRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<UserRecord | null> {
    return (this.db.query("SELECT * FROM users WHERE id = ?").get(id) as UserRecord | null) || null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return (
      (this.db.query("SELECT * FROM users WHERE email = ?").get(email) as UserRecord | null) || null
    );
  }

  async create(data: {
    id: string;
    email: string;
    roles?: string;
    created_at?: number;
  }): Promise<UserRecord> {
    const now = data.created_at || Date.now();
    const roles = data.roles || JSON.stringify(["user"]);

    this.db
      .query(
        `INSERT INTO users (id, email, is_active, roles, created_at, updated_at) 
         VALUES (?, ?, 1, ?, ?, ?)`,
      )
      .run(data.id, data.email, roles, now, now);

    return {
      id: data.id,
      email: data.email,
      is_active: 1,
      roles,
      created_at: now,
      updated_at: now,
    };
  }

  async updateRoles(id: string, rolesJson: string, updatedAt: number): Promise<void> {
    this.db
      .query("UPDATE users SET roles = ?, updated_at = ? WHERE id = ?")
      .run(rolesJson, updatedAt, id);
  }

  async setActive(id: string, isActive: number, updatedAt: number): Promise<void> {
    this.db
      .query("UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?")
      .run(isActive, updatedAt, id);
  }
}
