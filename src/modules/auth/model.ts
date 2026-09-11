import { t } from "elysia";

export const MagicLinkRequestSchema = t.Object({
  email: t.String({ format: "email" }),
});
export type MagicLinkRequest = typeof MagicLinkRequestSchema.static;

export const MagicLinkVerifySchema = t.Object({
  token: t.String({ minLength: 10 }),
});
export type MagicLinkVerify = typeof MagicLinkVerifySchema.static;

export const RefreshTokenSchema = t.Object({
  refreshToken: t.String({ minLength: 10 }),
});
export type RefreshTokenRequest = typeof RefreshTokenSchema.static;

export const LogoutSchema = t.Object({
  refreshToken: t.String({ minLength: 10 }),
});
export type LogoutRequest = typeof LogoutSchema.static;

export const AuthSuccessResponseSchema = t.Object({
  accessToken: t.String(),
  refreshToken: t.String(),
  isNewUser: t.Optional(t.Boolean()),
  user: t.Object({
    id: t.String(),
    email: t.String(),
    roles: t.Array(t.String()),
  }),
});
export type AuthSuccessResponse = typeof AuthSuccessResponseSchema.static;

export const MessageResponseSchema = t.Object({
  message: t.String(),
  debugToken: t.Optional(t.String()),
});
export type MessageResponse = typeof MessageResponseSchema.static;
