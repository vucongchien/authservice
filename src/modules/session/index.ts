import { Elysia, t } from "elysia";
import { authPlugin } from "../../common/auth-plugin";
import { SessionService } from "./service";

export const sessionController = new Elysia({ prefix: "/api/v1/auth/sessions" })
  .use(authPlugin)
  /**
   * List all active sessions
   */
  .get(
    "/",
    async ({ user }) => {
      return await SessionService.listSessions(user.id, user.familyId);
    },
    {
      isAuth: true,
      detail: {
        tags: ["Session & Devices"],
        summary: "Lấy danh sách các phiên thiết bị đang hoạt động",
        description:
          "Yêu cầu Bearer Access Token. Trả về thông tin IP, User-Agent, và cờ isCurrent.",
      },
    },
  )

  /**
   * Revoke all other sessions
   */
  .delete(
    "/",
    async ({ user }) => {
      return await SessionService.revokeAllOtherSessions(user.id, user.familyId);
    },
    {
      isAuth: true,
      detail: {
        tags: ["Session & Devices"],
        summary: "Đăng xuất khỏi tất cả các thiết bị khác",
      },
    },
  )

  /**
   * Revoke a specific session
   */
  .delete(
    "/:id",
    async ({ user, params }) => {
      return await SessionService.revokeSession(user.id, params.id);
    },
    {
      isAuth: true,
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ["Session & Devices"],
        summary: "Thu hồi một phiên đăng nhập thiết bị cụ thể",
      },
    },
  );
