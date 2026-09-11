import { status } from "elysia";

/**
 * Danh mục mã lỗi và thông điệp chuẩn hóa của AuthService
 */
export const AUTH_ERRORS = {
  // --- Magic Link & Token Lifecycle ---
  INVALID_OR_EXPIRED_TOKEN: {
    status: 400,
    code: "INVALID_OR_EXPIRED_TOKEN",
    message: "Token không tồn tại hoặc đã hết hạn",
  },
  ACCOUNT_DISABLED: {
    status: 403,
    code: "ACCOUNT_DISABLED",
    message: "Tài khoản của bạn đã bị khóa hoặc vô hiệu hóa",
  },
  TOKEN_REUSE_DETECTED: {
    status: 401,
    code: "TOKEN_REUSE_DETECTED",
    message:
      "Phát hiện phiên làm việc bất thường. Toàn bộ phiên đã bị thu hồi để bảo vệ tài khoản.",
  },
  INVALID_REFRESH_TOKEN: {
    status: 401,
    code: "INVALID_REFRESH_TOKEN",
    message: "Refresh token không hợp lệ hoặc đã hết hạn",
  },
  UNAUTHORIZED: {
    status: 401,
    code: "UNAUTHORIZED",
    message: "Yêu cầu xác thực tài khoản",
  },
  FORBIDDEN: {
    status: 403,
    code: "FORBIDDEN",
    message: "Bạn không có quyền thực hiện thao tác này",
  },

  // --- Google OAuth ---
  INVALID_CREDENTIALS: {
    status: 400,
    code: "INVALID_CREDENTIALS",
    message: "Vui lòng cung cấp idToken hoặc cặp code / codeVerifier hợp lệ",
  },
  INVALID_ID_TOKEN: {
    status: 400,
    code: "INVALID_ID_TOKEN",
    message: "Google ID Token không hợp lệ hoặc chưa được xác thực email",
  },

  // --- Session Management ---
  SESSION_NOT_FOUND: {
    status: 404,
    code: "SESSION_NOT_FOUND",
    message: "Phiên làm việc không tồn tại hoặc đã bị thu hồi trước đó",
  },

  // --- Admin ---
  USER_NOT_FOUND: {
    status: 404,
    code: "USER_NOT_FOUND",
    message: "Không tìm thấy người dùng trong hệ thống",
  },

  // --- Smart TV Device Flow (RFC 8628) ---
  AUTHORIZATION_PENDING: {
    status: 400,
    code: "AUTHORIZATION_PENDING",
    message: "Thiết bị chưa được người dùng xác thực trên điện thoại/máy tính",
  },
  AUTHORIZATION_EXPIRED: {
    status: 400,
    code: "AUTHORIZATION_EXPIRED",
    message: "Phiên xác thực thiết bị đã hết hạn",
  },
  AUTHORIZATION_DENIED: {
    status: 400,
    code: "AUTHORIZATION_DENIED",
    message: "Người dùng đã từ chối cấp quyền cho thiết bị này",
  },
  CODE_ALREADY_USED: {
    status: 400,
    code: "CODE_ALREADY_USED",
    message: "Mã xác thực thiết bị này đã được sử dụng",
  },
  CODE_ALREADY_PROCESSED: {
    status: 400,
    code: "CODE_ALREADY_PROCESSED",
    message: "Mã xác thực thiết bị này đã được xử lý trước đó",
  },
  INVALID_DEVICE_CODE: {
    status: 400,
    code: "INVALID_DEVICE_CODE",
    message: "Mã thiết bị không hợp lệ",
  },
  CODE_EXPIRED: {
    status: 400,
    code: "CODE_EXPIRED",
    message: "Phiên đăng nhập trên thiết bị đã hết hạn",
  },
  INVALID_USER_CODE: {
    status: 404,
    code: "INVALID_USER_CODE",
    message: "Mã thiết bị không tồn tại hoặc đã hết hạn",
  },
} as const;

export type AuthErrorCode = keyof typeof AUTH_ERRORS;

/**
 * Thông điệp thành công chuẩn hóa của AuthService
 */
export const AUTH_MESSAGES = {
  LOGOUT_SUCCESS: "Đăng xuất thành công",
  REVOKE_SESSION_SUCCESS: "Đã thu hồi phiên đăng nhập thành công",
  REVOKE_ALL_SESSIONS_SUCCESS: "Đã đăng xuất khỏi tất cả các thiết bị khác",
  DEVICE_AUTHORIZED_SUCCESS: "Thiết bị đã được cấp quyền đăng nhập thành công!",
  ROLE_UPDATED_SUCCESS: "Cập nhật quyền hệ thống thành công",
  MAGIC_LINK_SENT: "Nếu email hợp lệ, link đăng nhập bảo mật đã được gửi tới hòm thư của bạn.",
} as const;

/**
 * Trả về response lỗi chuẩn của Elysia kèm HTTP status, error code và message
 */
export function authError(key: AuthErrorCode, customMessage?: string) {
  const err = AUTH_ERRORS[key];
  return status(err.status, {
    error: err.code,
    message: customMessage || err.message,
  });
}
