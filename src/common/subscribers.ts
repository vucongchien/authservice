import { config } from "../config/env";
import { eventBus, type MagicLinkEvent } from "./events";

export function registerSubscribers() {
  eventBus.onEvent("auth.email.magic_link", (event: MagicLinkEvent) => {
    if (config.env !== "production" || config.debugExposeToken) {
      console.log(`
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔗 MAGIC LINK GENERATED (DEV CONSOLE LOGGER)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ Recipient:  ${event.email.padEnd(63)} │
│ Action URL: ${event.url.padEnd(63)} │
│ Expires:    ${event.expiresAt.toISOString().padEnd(63)} │
│ Token:      ${event.token.padEnd(63)} │
└─────────────────────────────────────────────────────────────────────────────┘
      `);
    }
  });
}
