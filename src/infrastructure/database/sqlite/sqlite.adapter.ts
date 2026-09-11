import { Database } from "bun:sqlite";
import type { IDatabase } from "../../../core/ports/database.port";
import type { IDeviceCodeRepository } from "../../../core/ports/device.repository";
import type { IMagicLinkRepository } from "../../../core/ports/magic-link.repository";
import type { IOAuthRepository } from "../../../core/ports/oauth.repository";
import type { IRefreshTokenRepository } from "../../../core/ports/token.repository";
import type { IUserRepository } from "../../../core/ports/user.repository";
import { SqliteDeviceCodeRepository } from "./device.repo";
import { SqliteMagicLinkRepository } from "./magic-link.repo";
import { SqliteOAuthRepository } from "./oauth.repo";
import { SQLITE_SCHEMA } from "./schema";
import { SqliteRefreshTokenRepository } from "./token.repo";
import { SqliteUserRepository } from "./user.repo";

export class SqliteDatabaseAdapter implements IDatabase {
  private db: Database;
  readonly users: IUserRepository;
  readonly magicLinks: IMagicLinkRepository;
  readonly tokens: IRefreshTokenRepository;
  readonly oauth: IOAuthRepository;
  readonly deviceCodes: IDeviceCodeRepository;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.run("PRAGMA journal_mode = WAL;");
    this.db.run("PRAGMA foreign_keys = ON;");
    this.db.run(SQLITE_SCHEMA);

    this.users = new SqliteUserRepository(this.db);
    this.magicLinks = new SqliteMagicLinkRepository(this.db);
    this.tokens = new SqliteRefreshTokenRepository(this.db);
    this.oauth = new SqliteOAuthRepository(this.db);
    this.deviceCodes = new SqliteDeviceCodeRepository(this.db);
  }

  async init(): Promise<void> {
    // Migration is already executed in constructor
  }

  async close(): Promise<void> {
    this.db.close();
  }

  getNativeDb(): Database {
    return this.db;
  }

  // Tiện ích tương thích cho test suite cục bộ
  run(sql: string, ...params: any[]) {
    return this.db.run(sql, ...params);
  }

  query(sql: string) {
    return this.db.query(sql);
  }

  transaction(fn: any): any {
    return this.db.transaction(fn);
  }
}
