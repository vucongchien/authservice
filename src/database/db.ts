import type { IDatabase } from "../core/ports/database.port";
import { createDatabaseAdapter } from "../infrastructure/database/factory";

export const db: IDatabase & Record<string, any> = createDatabaseAdapter();

export function getDb(): IDatabase {
  return db;
}

export * from "../core/ports";
