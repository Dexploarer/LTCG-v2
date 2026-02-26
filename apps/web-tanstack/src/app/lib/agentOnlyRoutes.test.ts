import { describe, expect, it } from "vitest";
import { shouldRedirectToAgentLobby } from "./agentOnlyRoutes";

describe("agent-only route hard-cut", () => {
  it("redirects blocked gameplay and account routes", () => {
    const blocked = [
      "/onboarding",
      "/profile",
      "/settings",
      "/collection",
      "/decks",
      "/decks/deck_1",
      "/cliques",
      "/duel",
      "/cards",
      "/cards/card_1",
      "/discord-callback",
      "/agent-dev",
      "/story",
      "/story/chapter_1",
      "/pvp",
      "/play/match_1",
    ];

    for (const path of blocked) {
      expect(shouldRedirectToAgentLobby(path)).toBe(true);
    }
  });

  it("keeps watcher/legal routes active", () => {
    const allowed = [
      "/",
      "/watch",
      "/stream-overlay",
      "/about",
      "/privacy",
      "/terms",
      "/token",
      "/agent-lobby",
    ];

    for (const path of allowed) {
      expect(shouldRedirectToAgentLobby(path)).toBe(false);
    }
  });
});
