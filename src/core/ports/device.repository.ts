import type { DeviceCodeRecord } from "../models";

export interface IDeviceCodeRepository {
  create(data: DeviceCodeRecord): Promise<void>;

  findByUserCode(userCode: string): Promise<DeviceCodeRecord | null>;

  findByDeviceCode(deviceCode: string): Promise<DeviceCodeRecord | null>;

  /**
   * Cấp quyền cho thiết bị Smart TV (PENDING -> AUTHORIZED)
   */
  authorize(userCode: string, userId: string, now: number): Promise<boolean>;

  /**
   * TV thăm dò và tiêu thụ mã (AUTHORIZED -> CONSUMED)
   */
  pollAndConsume(
    deviceCode: string,
    now: number,
  ): Promise<{ status: "PENDING" | "EXPIRED" | "AUTHORIZED" | "NOT_FOUND"; userId?: string }>;
}
