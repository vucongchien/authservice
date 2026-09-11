import { Elysia } from "elysia";
import { DeviceFlowService } from "./device.service";
import {
  DeviceAuthorizeRequestSchema,
  DeviceCodeRequestSchema,
  DevicePollRequestSchema,
  GoogleAuthRequestSchema,
} from "./model";
import { OAuthService } from "./service";

export const oauthController = new Elysia({ prefix: "/api/v1/auth/oauth" })
  /**
   * Unified Google Sign-In (OAuth 2.1 Standard)
   * Client calls this endpoint with { idToken } OR { code, codeVerifier, redirectUri }
   */
  .post(
    "/google",
    async ({ body, request }) => {
      const userAgent = request.headers.get("user-agent") || undefined;
      const ip = request.headers.get("x-forwarded-for") || undefined;
      return await OAuthService.loginWithGoogle(body, { userAgent, ip });
    },
    {
      body: GoogleAuthRequestSchema,
      detail: {
        tags: ["OAuth"],
        summary: "Đăng nhập Google (OAuth 2.1)",
        description:
          "Hỗ trợ 2 phương thức: Gửi trực tiếp { idToken } từ Google SDK hoặc { code, codeVerifier } qua PKCE.",
      },
    },
  )

  /**
   * Smart TV Device Code Request (RFC 8628)
   */
  .post(
    "/device/code",
    async ({ request }) => {
      const url = new URL(request.url);
      const clientBaseUrl = `${url.protocol}//${url.host}`;
      return await DeviceFlowService.requestDeviceCode(clientBaseUrl);
    },
    {
      body: DeviceCodeRequestSchema,
      detail: {
        tags: ["OAuth - Device Flow"],
        summary: "TV xin cấp Device Code & User Code hiển thị lên màn hình",
      },
    },
  )

  /**
   * Smart TV Poll Token
   */
  .post(
    "/device/poll",
    async ({ body, request }) => {
      const userAgent = request.headers.get("user-agent") || undefined;
      const ip = request.headers.get("x-forwarded-for") || undefined;
      return await DeviceFlowService.pollDeviceToken(body.deviceCode, {
        userAgent,
        ip,
        platform: "tv",
      });
    },
    {
      body: DevicePollRequestSchema,
      detail: {
        tags: ["OAuth - Device Flow"],
        summary: "TV poll định kỳ để lấy token sau khi người dùng xác nhận",
      },
    },
  )

  /**
   * User authorizes TV using User Code
   */
  .post(
    "/device/authorize",
    async ({ body }) => {
      return await DeviceFlowService.authorizeDevice(body.userCode, body.userId);
    },
    {
      body: DeviceAuthorizeRequestSchema,
      detail: {
        tags: ["OAuth - Device Flow"],
        summary: "Người dùng nhập mã trên điện thoại để cấp quyền đăng nhập cho TV",
      },
    },
  );
