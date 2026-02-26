import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "..", "..");

const readSource = (relativePath: string) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

describe("agent HTTP routes", () => {
  it("passes actorUserId to internal submitActionAsActor for agent actions", () => {
    const httpSource = readSource("convex/http.ts");

    expect(httpSource).toContain('path: "/api/agent/game/action"');
    expect(httpSource).toMatch(
      /path:\s*"\/api\/agent\/game\/action"[\s\S]*?ctx\.runMutation\(\s*internal\.game\.submitActionAsActor\s*,\s*\{[\s\S]*?actorUserId:\s*agent\.userId/,
    );
  });

  it("requires expectedVersion for /api/agent/game/action", () => {
    const httpSource = readSource("convex/http.ts");

    expect(httpSource).toContain("expectedVersion is required and must be a number");
    expect(httpSource).toMatch(
      /path:\s*"\/api\/agent\/game\/action"[\s\S]*?typeof expectedVersion !== "number"/,
    );
  });

  it("uses internal getPlayerViewAsActor for authenticated agent game view", () => {
    const httpSource = readSource("convex/http.ts");

    expect(httpSource).toContain('path: "/api/agent/game/view"');
    expect(httpSource).toMatch(
      /path:\s*"\/api\/agent\/game\/view"[\s\S]*?ctx\.runQuery\(\s*internal\.game\.getPlayerViewAsActor\s*,\s*\{[\s\S]*?actorUserId:\s*agent\.userId/,
    );
  });

  it("uses internal getMatchMetaAsActor for participant-scoped metadata reads", () => {
    const httpSource = readSource("convex/http.ts");

    expect(httpSource).toMatch(
      /resolveMatchAndSeat[\s\S]*?ctx\.runQuery\(\s*internal\.game\.getMatchMetaAsActor\s*,\s*\{[\s\S]*?actorUserId:\s*agentUserId/,
    );
  });

  it("includes latestSnapshotVersion in /api/agent/game/match-status", () => {
    const httpSource = readSource("convex/http.ts");

    expect(httpSource).toContain('path: "/api/agent/game/match-status"');
    expect(httpSource).toMatch(
      /path:\s*"\/api\/agent\/game\/match-status"[\s\S]*?internalApi\.game\.getLatestSnapshotVersionAsActor/,
    );
    expect(httpSource).toContain("latestSnapshotVersion");
  });

  it("exposes agent lobby snapshot/chat endpoints through agent-auth mutations", () => {
    const httpSource = readSource("convex/http.ts");

    expect(httpSource).toContain('path: "/api/agent/lobby/snapshot"');
    expect(httpSource).toContain("apiRef.agentLobby.getLobbySnapshotAsAgent");
    expect(httpSource).toContain('path: "/api/agent/lobby/chat"');
    expect(httpSource).toContain("apiRef.agentLobby.postLobbyMessageAsAgent");
  });

  it("exposes authoritative stream audio endpoints", () => {
    const httpSource = readSource("convex/http.ts");

    expect(httpSource).toContain('path: "/api/agent/stream/audio"');
    expect(httpSource).toContain("apiRef.streamAudio.getByAgentId");
    expect(httpSource).toContain("apiRef.streamAudio.getByMatchId");
    expect(httpSource).toContain("internalApi.streamAudio.upsertForAgent");
  });
});
