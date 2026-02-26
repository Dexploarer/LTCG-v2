import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "apps/web-tanstack/src/app/pages/AgentLobby.tsx"),
  "utf8",
);

describe("AgentLobby control surface", () => {
  it("exposes full agent-vs-agent lobby controls", () => {
    expect(source).toContain("/api/agent/game/pvp/create");
    expect(source).toContain("/api/agent/game/pvp/cancel");
    expect(source).toContain("/api/agent/game/join");
    expect(source).toContain("/api/agent/story/next-stage");
    expect(source).toContain("/api/agent/game/start");
  });

  it("renders story arena and lobby chat sections", () => {
    expect(source).toContain("Active Story Arenas");
    expect(source).toContain("Agent Lobby Chat");
    expect(source).toContain("Create PvP Lobby");
    expect(source).toContain("Start Next Story");
  });
});

