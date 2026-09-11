import { join } from "node:path";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { registerSubscribers } from "./common/subscribers";
import { adminController } from "./modules/admin";
import { authController } from "./modules/auth";
import { jwksController } from "./modules/jwks";
import { oauthController } from "./modules/oauth";
import { sessionController } from "./modules/session";

// Register background/dev event subscribers
registerSubscribers();

export const app = new Elysia()
  // Global Plugins
  .use(cors())
  .use(
    swagger({
      path: "/swagger",
      documentation: {
        info: {
          title: "Auth Service API",
          version: "1.0.0",
          description:
            "Plug-and-Play Authentication Service using Elysia + Bun. 100% Passwordless with Magic Link, Google OAuth, Token Rotation, and Decentralized JWKS verification.",
        },
        tags: [
          { name: "Auth", description: "Magic Link, Token Rotation, Logout" },
          { name: "OAuth", description: "Google Mobile & Web PKCE" },
          { name: "OAuth - Device Flow", description: "Smart TV RFC 8628 Authorization" },
          {
            name: "Session & Devices",
            description: "Multi-device session tracking and revocation",
          },
          { name: "JWKS Discovery", description: "Public key distribution for other services" },
          { name: "Admin", description: "System roles management" },
        ],
      },
    }),
  )

  // Health check endpoint
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }), {
    detail: {
      tags: ["Health"],
      summary: "Kiểm tra trạng thái hoạt động của service",
    },
  })

  // Favicon handler
  .get("/favicon.ico", () => new Response(null, { status: 204 }))

  // Embedded Demo Client Showcase
  // I have nothing but my burger and I want nothing more
  .get("/demo", () => Bun.file(join(import.meta.dir, "../docs/demo/index.html")))
  .get("/demo/index.html", () => Bun.file(join(import.meta.dir, "../docs/demo/index.html")))
  .get("/demo/style.css", () => Bun.file(join(import.meta.dir, "../docs/demo/style.css")))
  .get("/demo/app.js", () => Bun.file(join(import.meta.dir, "../docs/demo/app.js")))
  // Fallback aliases for root requests
  .get("/style.css", () => Bun.file(join(import.meta.dir, "../docs/demo/style.css")))
  .get("/app.js", () => Bun.file(join(import.meta.dir, "../docs/demo/app.js")))

  // Mount Feature Modules
  .use(authController)
  .use(oauthController)
  .use(sessionController)
  .use(jwksController)
  .use(adminController);

export type App = typeof app;
