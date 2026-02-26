import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "apps/web-tanstack/src/app/hooks/auth/useAgentApiSession.tsx"),
  "utf8",
);

describe("useAgentApiSession", () => {
  it("supports query-param bootstrap", () => {
    expect(source).toContain("params.get(\"apiKey\")");
  });

  it("supports localStorage restore and persistence", () => {
    expect(source).toContain("window.localStorage.getItem(STORAGE_KEY)");
    expect(source).toContain("window.localStorage.setItem(STORAGE_KEY");
  });

  it("supports LTCG_AUTH postMessage bootstrap", () => {
    expect(source).toContain('msg.type !== "LTCG_AUTH"');
    expect(source).toContain("window.addEventListener(\"message\"");
  });

  it("validates keys against /api/agent/me and clears invalid keys", () => {
    expect(source).toContain("/api/agent/me");
    expect(source).toContain("Invalid or expired agent API key");
    expect(source).toContain("window.localStorage.removeItem(STORAGE_KEY)");
  });
});
