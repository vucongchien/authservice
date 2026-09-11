import { Elysia } from "elysia";
import { getKeyManager } from "../../config/keys";

export const jwksController = new Elysia()
  /**
   * RFC 7517 JWKS Discovery Endpoint
   */
  .get(
    "/.well-known/jwks.json",
    async ({ set }) => {
      const keyManager = await getKeyManager();
      set.headers["Cache-Control"] = "public, max-age=86400"; // Cache for 24 hours
      return keyManager.jwks;
    },
    {
      detail: {
        tags: ["JWKS Discovery"],
        summary: "Cung cấp Public Key (RFC 7517) cho các service vệ tinh tự giải mã JWT",
        description:
          "Các microservice khác chỉ cần fetch endpoint này và cache lại, không cần gọi Auth Service mỗi request.",
      },
    },
  );
