import { t } from "elysia";

export const UpdateRolesSchema = t.Object({
  roles: t.Array(t.String({ minLength: 1 })),
});
export type UpdateRolesRequest = typeof UpdateRolesSchema.static;
