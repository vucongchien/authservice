import type { Database } from "bun:sqlite";
import type { DeviceCodeRecord } from "../../../core/models";
import type { IDeviceCodeRepository } from "../../../core/ports/device.repository";

export class SqliteDeviceCodeRepository implements IDeviceCodeRepository {
  constructor(private db: Database) {}

  async create(data: DeviceCodeRecord): Promise<void> {
    this.db
      .query(
        `INSERT INTO device_codes (id, device_code, user_code, status, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        data.id,
        data.device_code,
        data.user_code,
        data.status,
        data.expires_at,
        data.created_at,
      );
  }

  async findByUserCode(userCode: string): Promise<DeviceCodeRecord | null> {
    return (
      (this.db
        .query("SELECT * FROM device_codes WHERE user_code = ?")
        .get(userCode) as DeviceCodeRecord | null) || null
    );
  }

  async findByDeviceCode(deviceCode: string): Promise<DeviceCodeRecord | null> {
    return (
      (this.db
        .query("SELECT * FROM device_codes WHERE device_code = ?")
        .get(deviceCode) as DeviceCodeRecord | null) || null
    );
  }

  async authorize(userCode: string, userId: string, now: number): Promise<boolean> {
    const res = this.db
      .query(
        `UPDATE device_codes 
         SET user_id = ?, status = 'AUTHORIZED' 
         WHERE user_code = ? AND status = 'PENDING' AND expires_at > ?`,
      )
      .run(userId, userCode, now);

    return res.changes > 0;
  }

  async pollAndConsume(
    deviceCode: string,
    now: number,
  ): Promise<{ status: "PENDING" | "EXPIRED" | "AUTHORIZED" | "NOT_FOUND"; userId?: string }> {
    const record = await this.findByDeviceCode(deviceCode);
    if (!record) {
      return { status: "NOT_FOUND" };
    }

    if (record.expires_at <= now) {
      return { status: "EXPIRED" };
    }

    if (record.status === "PENDING") {
      return { status: "PENDING" };
    }

    if (record.status === "AUTHORIZED" && record.user_id) {
      // Atomic status transition: AUTHORIZED -> CONSUMED
      const updateRes = this.db
        .query("UPDATE device_codes SET status = 'CONSUMED' WHERE id = ? AND status = 'AUTHORIZED'")
        .run(record.id);

      if (updateRes.changes === 1) {
        return { status: "AUTHORIZED", userId: record.user_id };
      }
      // Nếu đã bị tiêu thụ song song
      return { status: "PENDING" };
    }

    return { status: "PENDING" };
  }
}
