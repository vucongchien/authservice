import { app } from "./app";
import { config } from "./config/env";

app.listen(config.port, () => {
  console.log(`🦊 AuthService (Elysia + Bun) is running at ${config.baseUrl}`);
  console.log(`📚 Swagger documentation available at ${config.baseUrl}/swagger`);
  console.log(`🔑 JWKS endpoint available at ${config.baseUrl}/.well-known/jwks.json`);
  console.log(`🛡️ Live Demo client available at ${config.baseUrl}/demo/`);
});
