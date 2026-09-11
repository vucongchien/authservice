import { describe, expect, it } from "bun:test";
import { app } from "../../src/app";

describe("E2E: Embedded Demo Client Showcase", () => {
  it("should serve demo index.html at /demo", async () => {
    const res = await app.handle(new Request("http://localhost:3000/demo"));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("AuthService Demo");
  });

  it("should serve demo index.html at /demo/ and /demo/index.html", async () => {
    const res = await app.handle(new Request("http://localhost:3000/demo/"));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("AuthService Demo");
    expect(html).toContain("Magic Link");
    expect(html).toContain("Google OAuth");
  });

  it("should serve stylesheet at /demo/style.css with correct content", async () => {
    const res = await app.handle(new Request("http://localhost:3000/demo/style.css"));
    expect(res.status).toBe(200);
    const css = await res.text();
    expect(css).toContain(".container");
  });

  it("should serve client script at /demo/app.js with correct content", async () => {
    const res = await app.handle(new Request("http://localhost:3000/demo/app.js"));
    expect(res.status).toBe(200);
    const js = await res.text();
    expect(js).toContain("btnRequestMagicLink");
    expect(js).toContain("btnMockGoogleLogin");
  });
});
