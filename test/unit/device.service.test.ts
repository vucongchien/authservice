import { beforeEach, describe, expect, it } from "bun:test";
import * as crypto from "node:crypto";
import { db } from "../../src/database/db";
import { DeviceFlowService } from "../../src/modules/oauth/device.service";

describe("DeviceFlowService Unit Tests", () => {
  beforeEach(() => {
    db.run("DELETE FROM device_codes");
    db.run("DELETE FROM refresh_tokens");
    db.run("DELETE FROM users");
  });

  it("should generate device code and user code", async () => {
    const res = await DeviceFlowService.requestDeviceCode("http://localhost:3000");

    expect(res.deviceCode).toBeDefined();
    expect(res.userCode).toBeDefined();
    expect(res.userCode.length).toBe(9); // XXXX-XXXX
    expect(res.verificationUri).toBe("http://localhost:3000/device");
    expect(res.expiresIn).toBe(600);
    expect(res.interval).toBe(5);
  });

  it("should handle the complete TV device authorization lifecycle", async () => {
    // 1. TV requests codes
    const codes = await DeviceFlowService.requestDeviceCode();

    // 2. TV polls immediately while status is PENDING
    const initialPoll = (await DeviceFlowService.pollDeviceToken(codes.deviceCode)) as any;
    expect(initialPoll.code).toBe(400);
    expect(initialPoll.response.error).toBe("AUTHORIZATION_PENDING");

    // 3. User logs in and authorizes the device code
    const mockUserId = crypto.randomUUID();
    const now = Date.now();
    db.run(
      `INSERT INTO users (id, email, is_active, roles, created_at, updated_at)
       VALUES (?, 'tvuser@test.com', 1, '["user"]', ?, ?)`,
      [mockUserId, now, now],
    );

    const authRes = (await DeviceFlowService.authorizeDevice(codes.userCode, mockUserId)) as any;
    expect(authRes.success).toBe(true);

    // 4. TV polls again -> Receives Access Token and Refresh Token!
    const authorizedPoll = (await DeviceFlowService.pollDeviceToken(codes.deviceCode)) as any;
    expect(authorizedPoll.accessToken).toBeDefined();
    expect(authorizedPoll.refreshToken).toBeDefined();
    expect(authorizedPoll.user.email).toBe("tvuser@test.com");

    // 5. Subsequent poll with same device code fails (consumed)
    const consumedPoll = (await DeviceFlowService.pollDeviceToken(codes.deviceCode)) as any;
    expect(consumedPoll.code).toBe(400);
    expect(consumedPoll.response.error).toBe("CODE_ALREADY_USED");
  });
});
