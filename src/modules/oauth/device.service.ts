import * as crypto from "node:crypto";
import { AUTH_MESSAGES, authError } from "../../common/errors";
import { generateSecureToken, generateUserCode } from "../../common/utils";
import { config } from "../../config/env";
import type { DeviceCodeRecord, UserRecord } from "../../core/models";
import { db } from "../../database/db";
import { TokenService } from "../token/token.service";

// Re-export for backward compatibility
export type { DeviceCodeRecord } from "../../core/models";

export abstract class DeviceFlowService {
  /**
   * Device requests a code pair (TV displays user_code on screen)
   */
  static async requestDeviceCode(clientBaseUrl?: string) {
    const deviceCode = generateSecureToken(32);
    const userCode = generateUserCode();
    const now = Date.now();
    const expiresInSeconds = config.deviceFlow.ttlMinutes * 60;
    const expiresAt = now + expiresInSeconds * 1000;

    const id = crypto.randomUUID();
    await db.deviceCodes.create({
      id,
      device_code: deviceCode,
      user_code: userCode,
      user_id: null,
      status: "PENDING",
      expires_at: expiresAt,
      created_at: now,
    });

    const baseUrl = clientBaseUrl || config.baseUrl;
    const verificationUri = `${baseUrl}/device`;
    const verificationUriComplete = `${verificationUri}?user_code=${userCode}`;

    return {
      deviceCode,
      userCode,
      verificationUri,
      verificationUriComplete,
      expiresIn: expiresInSeconds,
      interval: config.deviceFlow.pollIntervalSeconds,
    };
  }

  /**
   * Device polls periodically to see if user authorized the code
   */
  static async pollDeviceToken(deviceCode: string, deviceInfo?: Record<string, any>) {
    const now = Date.now();

    const record = await db.deviceCodes.findByDeviceCode(deviceCode);
    if (!record) {
      return authError("INVALID_DEVICE_CODE");
    }

    if (record.expires_at < now || record.status === "EXPIRED") {
      return authError("CODE_EXPIRED");
    }

    if (record.status === "PENDING") {
      return authError("AUTHORIZATION_PENDING");
    }

    if (record.status === "CONSUMED") {
      return authError("CODE_ALREADY_USED");
    }

    if (record.status === "AUTHORIZED" && record.user_id) {
      const pollResult = await db.deviceCodes.pollAndConsume(deviceCode, now);
      if (pollResult.status !== "AUTHORIZED" || !pollResult.userId) {
        return authError("CODE_ALREADY_USED");
      }

      const user = await db.users.findById(pollResult.userId);
      if (!user || user.is_active !== 1) {
        return authError("ACCOUNT_DISABLED");
      }

      // Cấp session token dùng chung từ TokenService
      return await TokenService.issueSessionTokens(user, deviceInfo || { type: "Smart TV" });
    }

    return authError("INVALID_OR_EXPIRED_TOKEN", "Trạng thái không hợp lệ");
  }

  /**
   * User enters user_code on phone/PC to authorize TV
   */
  static async authorizeDevice(userCode: string, userId: string) {
    const cleanUserCode = userCode.trim().toUpperCase();
    const now = Date.now();

    const record = await db.deviceCodes.findByUserCode(cleanUserCode);
    if (!record) {
      return authError("INVALID_USER_CODE");
    }

    if (record.expires_at < now) {
      return authError("AUTHORIZATION_EXPIRED");
    }

    if (record.status !== "PENDING") {
      return authError("CODE_ALREADY_PROCESSED");
    }

    // Atomic Authorization thông qua DeviceCode Port
    const authorized = await db.deviceCodes.authorize(cleanUserCode, userId, now);
    if (!authorized) {
      return authError("CODE_ALREADY_PROCESSED");
    }

    return {
      success: true,
      message: AUTH_MESSAGES.DEVICE_AUTHORIZED_SUCCESS,
    };
  }
}
