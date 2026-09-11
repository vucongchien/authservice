import { Elysia } from "elysia";
import {
  LogoutSchema,
  MagicLinkRequestSchema,
  MagicLinkVerifySchema,
  MessageResponseSchema,
  RefreshTokenSchema,
} from "./model";
import { AuthService } from "./service";

export const authController = new Elysia({ prefix: "/api/v1/auth" })
  /**
   * Request a magic link
   */
  .post(
    "/magic-link",
    async ({ body, request }) => {
      const url = new URL(request.url);
      const clientBaseUrl = `${url.protocol}//${url.host}`;
      return await AuthService.requestMagicLink(body.email, clientBaseUrl);
    },
    {
      body: MagicLinkRequestSchema,
      response: {
        200: MessageResponseSchema,
      },
      detail: {
        tags: ["Auth"],
        summary: "Yêu cầu gửi liên kết đăng nhập (Magic Link)",
        description:
          "Gửi token xác thực qua email (dev mode in ra terminal). Phản hồi đồng nhất chống dò quét user.",
      },
    },
  )

  /**
   * Verify magic link (POST) - Single source of truth
   */
  .post(
    "/magic-link/verify",
    async ({ body, request }) => {
      const userAgent = request.headers.get("user-agent") || undefined;
      const ip = request.headers.get("x-forwarded-for") || undefined;
      return await AuthService.verifyMagicLink(body.token, { userAgent, ip });
    },
    {
      body: MagicLinkVerifySchema,
      detail: {
        tags: ["Auth"],
        summary: "Xác thực Magic Link và cấp cặp Token",
        description:
          "Tự động đăng ký nếu email mới. Trả về JWT Access Token (RS256) và Refresh Token.",
      },
    },
  )

  /**
   * Token Rotation (RTR)
   */
  .post(
    "/token/refresh",
    async ({ body, request }) => {
      const userAgent = request.headers.get("user-agent") || undefined;
      const ip = request.headers.get("x-forwarded-for") || undefined;
      return await AuthService.refreshToken(body.refreshToken, { userAgent, ip });
    },
    {
      body: RefreshTokenSchema,
      detail: {
        tags: ["Auth"],
        summary: "Làm mới Access Token bằng Refresh Token (Token Rotation)",
        description:
          "Kèm cơ chế Reuse Detection: Nếu token cũ bị dùng lại -> Thu hồi toàn bộ session family!",
      },
    },
  )

  /**
   * Logout
   */
  .post(
    "/logout",
    async ({ body }) => {
      return await AuthService.logout(body.refreshToken);
    },
    {
      body: LogoutSchema,
      detail: {
        tags: ["Auth"],
        summary: "Đăng xuất tài khoản (Thu hồi Refresh Token)",
      },
    },
  );
