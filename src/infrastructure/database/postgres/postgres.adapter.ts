import postgres, { type Sql } from "postgres";
import type { IDatabase } from "../../../core/ports/database.port";
import type { IDeviceCodeRepository } from "../../../core/ports/device.repository";
import type { IMagicLinkRepository } from "../../../core/ports/magic-link.repository";
import type { IOAuthRepository } from "../../../core/ports/oauth.repository";
import type { IRefreshTokenRepository } from "../../../core/ports/token.repository";
import type { IUserRepository } from "../../../core/ports/user.repository";
import { PostgresDeviceCodeRepository } from "./device.repo";
import { PostgresMagicLinkRepository } from "./magic-link.repo";
import { PostgresOAuthRepository } from "./oauth.repo";
import { POSTGRES_SCHEMA } from "./schema";
import { PostgresRefreshTokenRepository } from "./token.repo";
import { PostgresUserRepository } from "./user.repo";

export class PostgresDatabaseAdapter implements IDatabase {
  private sql: Sql;
  readonly users: IUserRepository;
  readonly magicLinks: IMagicLinkRepository;
  readonly tokens: IRefreshTokenRepository;
  readonly oauth: IOAuthRepository;
  readonly deviceCodes: IDeviceCodeRepository;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, {
      max: 20,
      idle_timeout: 30,
      connect_timeout: 10,
    });

    this.users = new PostgresUserRepository(this.sql);
    this.magicLinks = new PostgresMagicLinkRepository(this.sql);
    this.tokens = new PostgresRefreshTokenRepository(this.sql);
    this.oauth = new PostgresOAuthRepository(this.sql);
    this.deviceCodes = new PostgresDeviceCodeRepository(this.sql);
  }

  async init(): Promise<void> {
    // Tự động chạy migration tạo bảng trên PostgreSQL
    await this.sql.unsafe(POSTGRES_SCHEMA);
  }

  async close(): Promise<void> {
    await this.sql.end();
  }

  getNativeSql(): Sql {
    return this.sql;
  }
}
