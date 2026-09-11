import { AUTH_MESSAGES, authError } from "../../common/errors";
import { db } from "../../database/db";

export abstract class AdminService {
  /**
   * Update system-level roles for a user
   */
  static async updateUserRoles(targetUserId: string, roles: string[]) {
    const now = Date.now();

    const user = await db.users.findById(targetUserId);
    if (!user) {
      return authError("USER_NOT_FOUND");
    }

    const cleanRoles = Array.from(new Set(roles.map((r) => r.trim().toLowerCase())));
    const rolesJson = JSON.stringify(cleanRoles);

    await db.users.updateRoles(targetUserId, rolesJson, now);

    return {
      success: true,
      message: AUTH_MESSAGES.ROLE_UPDATED_SUCCESS,
      user: {
        id: targetUserId,
        roles: cleanRoles,
      },
    };
  }
}
