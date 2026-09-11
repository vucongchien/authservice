import { t } from "elysia";

export const GoogleAuthRequestSchema = t.Object({
  idToken: t.Optional(t.String({ minLength: 10 })),
  code: t.Optional(t.String({ minLength: 1 })),
  codeVerifier: t.Optional(t.String({ minLength: 10 })),
  redirectUri: t.Optional(t.String()),
});
export type GoogleAuthRequest = typeof GoogleAuthRequestSchema.static;

export const DeviceCodeRequestSchema = t.Object({
  clientId: t.Optional(t.String()),
});
export type DeviceCodeRequest = typeof DeviceCodeRequestSchema.static;

export const DevicePollRequestSchema = t.Object({
  deviceCode: t.String({ minLength: 10 }),
});
export type DevicePollRequest = typeof DevicePollRequestSchema.static;

export const DeviceAuthorizeRequestSchema = t.Object({
  userCode: t.String({ minLength: 8 }),
  userId: t.String({ minLength: 1 }),
});
export type DeviceAuthorizeRequest = typeof DeviceAuthorizeRequestSchema.static;
