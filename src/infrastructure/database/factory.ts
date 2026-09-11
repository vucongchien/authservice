import { config } from "../../config/env";
import type { IDatabase } from "../../core/ports/database.port";
import { PostgresDatabaseAdapter } from "./postgres/postgres.adapter";
import { SqliteDatabaseAdapter } from "./sqlite/sqlite.adapter";

export function createDatabaseAdapter(): IDatabase {
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl && (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://"))) {
    console.log("🔌 Database Adapter: Connected to PostgreSQL");
    const adapter = new PostgresDatabaseAdapter(dbUrl);
    // Chạy migration bất đồng bộ ngầm khi khởi động
    adapter.init().catch((err) => {
      console.error("❌ Failed to initialize PostgreSQL schema:", err);
    });
    return adapter;
  }

  const sqlitePath = process.env.DB_PATH || config.db.path;
  return new SqliteDatabaseAdapter(sqlitePath);
}
