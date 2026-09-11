import { Elysia, t } from "elysia";
import { authPlugin } from "../../common/auth-plugin";
import { UpdateRolesSchema } from "./model";
import { AdminService } from "./service";

export const adminController = new Elysia({ prefix: "/api/v1/admin" })
  .use(authPlugin)
  /**
   * Update system-level roles
   */
  .patch(
    "/users/:id/roles",
    async ({ params, body }) => {
      return await AdminService.updateUserRoles(params.id, body.roles);
    },
    {
      isAdmin: true,
      params: t.Object({
        id: t.String(),
      }),
      body: UpdateRolesSchema,
      detail: {
        tags: ["Admin"],
        summary: "Admin cập nhật Role cấp hệ thống cho người dùng",
        description: "Yêu cầu Bearer Access Token có quyền 'admin'.",
      },
    },
  );
