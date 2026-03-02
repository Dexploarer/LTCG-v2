import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "apps/web-tanstack/src/app/hooks/useStreamOverlay.ts"),
  "utf8",
);

describe("useStreamOverlay audio hydration", () => {
  it("loads stream-audio control through HTTP match resolver", () => {
    expect(source).toContain("/api/agent/stream/audio?matchId=");
    expect(source).toContain("fetchStreamAudioControl");
  });

  it("does not bind stream-audio control to direct Convex client queries", () => {
    expect(source).not.toContain("apiAny.streamAudio");
    expect(source).toContain("window.setInterval(() =>");
  });
});
