import { t } from "elysia";

export const SessionItemSchema = t.Object({
  id: t.String(),
  familyId: t.String(),
  deviceInfo: t.Any(),
  createdAt: t.Number(),
  lastUsedAt: t.Number(),
  expiresAt: t.Number(),
  isCurrent: t.Boolean(),
});

export const SessionsListResponseSchema = t.Array(SessionItemSchema);
