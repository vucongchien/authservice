import { Elysia } from "elysia";
import { getKeyManager } from "../config/keys";
import { authError } from "./errors";

export interface AuthContextUser {
  id: string;
  email: string;
  roles: string[];
  familyId?: string;
}

export const authPlugin = new Elysia({ name: "app.auth.plugin" }).macro({
  isAuth: {
    async resolve({ headers }) {
      const authHeader = headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return authError(
          "UNAUTHORIZED",
          "Thiếu Bearer Access Token hợp lệ trong Authorization header",
        );
      }

      const token = authHeader.substring(7);
      try {
        const keyManager = await getKeyManager();
        const payload = await keyManager.verifyJwt<{
          sub: string;
          email: string;
          roles: string[];
          familyId?: string;
        }>(token);

        return {
          user: {
            id: payload.sub,
            email: payload.email,
            roles: payload.roles || [],
            familyId: payload.familyId,
          } as AuthContextUser,
        };
      } catch (err) {
        return authError("INVALID_OR_EXPIRED_TOKEN", "Access Token không hợp lệ hoặc đã hết hạn");
      }
    },
  },

  isAdmin: {
    async resolve({ headers }) {
      const authHeader = headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return authError("UNAUTHORIZED", "Thiếu Bearer Access Token");
      }

      const token = authHeader.substring(7);
      try {
        const keyManager = await getKeyManager();
        const payload = await keyManager.verifyJwt<{
          sub: string;
          email: string;
          roles: string[];
          familyId?: string;
        }>(token);

        if (!payload.roles || !payload.roles.includes("admin")) {
          return authError("FORBIDDEN", "Yêu cầu quyền Admin hệ thống");
        }

        return {
          user: {
            id: payload.sub,
            email: payload.email,
            roles: payload.roles,
            familyId: payload.familyId,
          } as AuthContextUser,
        };
      } catch (err) {
        return authError("INVALID_OR_EXPIRED_TOKEN", "Access Token không hợp lệ hoặc đã hết hạn");
      }
    },
  },
});
