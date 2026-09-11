import type { Sql } from "postgres";
import type { DeviceCodeRecord } from "../../../core/models";
import type { IDeviceCodeRepository } from "../../../core/ports/device.repository";

export class PostgresDeviceCodeRepository implements IDeviceCodeRepository {
  constructor(private sql: Sql) {}

  private mapDevice(row: any): DeviceCodeRecord {
    return {
      id: row.id,
      device_code: row.device_code,
      user_code: row.user_code,
      user_id: row.user_id,
      status: row.status,
      expires_at: Number(row.expires_at),
      created_at: Number(row.created_at),
    };
  }

  async create(data: DeviceCodeRecord): Promise<void> {
    await this.sql`
      INSERT INTO device_codes (id, device_code, user_code, status, expires_at, created_at)
      VALUES (${data.id}, ${data.device_code}, ${data.user_code}, ${data.status}, ${data.expires_at}, ${data.created_at})
    `;
  }

  async findByUserCode(userCode: string): Promise<DeviceCodeRecord | null> {
    const rows = await this.sql`
      SELECT * FROM device_codes WHERE user_code = ${userCode} LIMIT 1
    `;
    return rows.length > 0 ? this.mapDevice(rows[0]) : null;
  }

  async findByDeviceCode(deviceCode: string): Promise<DeviceCodeRecord | null> {
    const rows = await this.sql`
      SELECT * FROM device_codes WHERE device_code = ${deviceCode} LIMIT 1
    `;
    return rows.length > 0 ? this.mapDevice(rows[0]) : null;
  }

  async authorize(userCode: string, userId: string, now: number): Promise<boolean> {
    const rows = await this.sql`
      UPDATE device_codes 
      SET user_id = ${userId}, status = 'AUTHORIZED' 
      WHERE user_code = ${userCode} AND status = 'PENDING' AND expires_at > ${now}
      RETURNING id
    `;
    return rows.length > 0;
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
      const rows = await this.sql`
        UPDATE device_codes 
        SET status = 'CONSUMED' 
        WHERE id = ${record.id} AND status = 'AUTHORIZED'
        RETURNING id
      `;

      if (rows.length === 1) {
        return { status: "AUTHORIZED", userId: record.user_id };
      }
      return { status: "PENDING" };
    }

    return { status: "PENDING" };
  }
}
