import { describe, expect, it } from "vitest";
import { buildPublicEventLog, buildPublicSpectatorView } from "../publicSpectator";

describe("public spectator safety", () => {
  it("builds a public-safe board view without exposing hand identities", () => {
    const view = buildPublicSpectatorView({
      matchId: "m_1",
      seat: "host",
      status: "active",
      mode: "pvp",
      chapterId: null,
      stageNumber: null,
      cardLookup: {
        c1: { name: "Alpha", cardType: "stereotype", attack: 1800, defense: 1200 },
        c2: { name: "Trap Hole", cardType: "trap" },
      },
      view: {
        hand: ["c1", "c2"],
        opponentHandCount: 4,
        board: [{ definitionId: "c1", faceDown: false, position: "attack" }],
        opponentBoard: [{ definitionId: "c1", faceDown: true, position: "defense" }],
        spellTrapZone: [{ definitionId: "c2", faceDown: false }],
        opponentSpellTrapZone: [{ definitionId: "c2", faceDown: true }],
        lifePoints: 7600,
        opponentLifePoints: 6500,
      },
    });

    expect(view.players.agent.handCount).toBe(2);
    expect("hand" in (view.players.agent as unknown as Record<string, unknown>)).toBe(false);
    expect(view.fields.opponent.monsters[0]?.name).toBeNull();
    expect(view.fields.opponent.monsters[0]?.attack).toBeNull();
    expect(view.fields.opponent.spellTraps[0]?.name).toBeNull();
  });

  it("emits sanitized event timeline entries without raw payload leakage", () => {
    const events = buildPublicEventLog({
      agentSeat: "away",
      batches: [
        {
          version: 3,
          createdAt: 12345,
          seat: "away",
          events: JSON.stringify([
            { type: "MONSTER_SUMMONED", cardId: "secret-id", targetId: "x1" },
          ]),
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.actor).toBe("agent");
    expect(events[0]?.eventType).toBe("MONSTER_SUMMONED");
    expect(events[0]?.summary).toContain("summoned");
    expect(events[0]?.rationale.length).toBeGreaterThan(0);
    expect(JSON.stringify(events[0])).not.toContain("secret-id");
    expect(JSON.stringify(events[0])).not.toContain("targetId");
  });
});
