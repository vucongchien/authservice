export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),
  baseUrl: process.env.BASE_URL || "http://localhost:3000",
  jwt: {
    issuer: process.env.JWT_ISSUER || "authservice",
    audience: process.env.JWT_AUDIENCE || "authservice-clients",
    accessTokenTtlSeconds: parseInt(process.env.ACCESS_TOKEN_TTL || "900", 10), // 15 minutes
    refreshTokenTtlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || "14", 10), // 14 days
  },
  magicLink: {
    ttlMinutes: parseInt(process.env.MAGIC_LINK_TTL_MINUTES || "15", 10), // 15 minutes
  },
  deviceFlow: {
    ttlMinutes: parseInt(process.env.DEVICE_CODE_TTL_MINUTES || "10", 10), // 10 minutes
    pollIntervalSeconds: parseInt(process.env.DEVICE_POLL_INTERVAL || "5", 10),
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "mock-google-client-id.apps.googleusercontent.com",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "mock-google-client-secret",
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/v1/auth/oauth/google/callback",
  },
  db: {
    path: process.env.DB_PATH || "authservice.db",
  },
  debugExposeToken:
    process.env.DEBUG_EXPOSE_TOKEN === "true" || process.env.NODE_ENV !== "production",
};
