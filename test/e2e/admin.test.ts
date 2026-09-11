import { beforeEach, describe, expect, it } from "bun:test";
import { app } from "../../src/app";
import { getKeyManager } from "../../src/config/keys";
import { db } from "../../src/database/db";

describe("E2E: Admin Role Management", () => {
  beforeEach(() => {
    db.run("DELETE FROM magic_link_tokens");
    db.run("DELETE FROM refresh_tokens");
    db.run("DELETE FROM users");
  });

  it("should enforce admin role guard and allow admins to update user roles", async () => {
    const keyManager = await getKeyManager();

    // Create target user
    const targetReq = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "target-user@example.com" }),
      }),
    );
    const { debugToken } = (await targetReq.json()) as any;
    const targetVerify = await app.handle(
      new Request("http://localhost:3000/api/v1/auth/magic-link/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: debugToken }),
      }),
    );
    const { user: targetUser, accessToken: regularToken } = (await targetVerify.json()) as any;

    // 1. Regular user tries to update roles -> 403 Forbidden
    const forbiddenRes = await app.handle(
      new Request(`http://localhost:3000/api/v1/admin/users/${targetUser.id}/roles`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${regularToken}`,
        },
        body: JSON.stringify({ roles: ["admin", "user"] }),
      }),
    );
    expect(forbiddenRes.status).toBe(403);

    // 2. Mint an Admin Access Token
    const adminToken = await keyManager.signJwt({
      sub: "admin-id-1",
      email: "superadmin@example.com",
      roles: ["admin"],
    });

    // 3. Admin updates roles for target user -> 200 OK
    const updateRes = await app.handle(
      new Request(`http://localhost:3000/api/v1/admin/users/${targetUser.id}/roles`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ roles: ["manager", "editor"] }),
      }),
    );
    expect(updateRes.status).toBe(200);
    const updateData = (await updateRes.json()) as any;
    expect(updateData.success).toBe(true);
    expect(updateData.user.roles).toEqual(["manager", "editor"]);

    // Verify in DB
    const userInDb = db.query("SELECT roles FROM users WHERE id = ?").get(targetUser.id) as any;
    expect(JSON.parse(userInDb.roles)).toEqual(["manager", "editor"]);
  });
});
