import { describe, expect, it } from "vitest";
import { appendTimelineEntries, clampSeat, type PublicEventLogEntry } from "./useAgentSpectator";

describe("useAgentSpectator helpers", () => {
  it("normalizes seat values safely", () => {
    expect(clampSeat("host")).toBe("host");
    expect(clampSeat("away")).toBe("away");
    expect(clampSeat("spectator")).toBeNull();
    expect(clampSeat(null)).toBeNull();
  });

  it("appends timeline entries with deterministic tail truncation", () => {
    const previous: PublicEventLogEntry[] = [
      {
        version: 1,
        createdAt: 1000,
        actor: "system",
        eventType: "TURN_STARTED",
        summary: "Turn started",
        rationale: "Advance.",
      },
      {
        version: 2,
        createdAt: 1001,
        actor: "agent",
        eventType: "MONSTER_SUMMONED",
        summary: "Summoned",
        rationale: "Build board.",
      },
    ];
    const incoming: PublicEventLogEntry[] = [
      {
        version: 3,
        createdAt: 1002,
        actor: "opponent",
        eventType: "SPELL_TRAP_SET",
        summary: "Set card",
        rationale: "Prepare response.",
      },
      {
        version: 4,
        createdAt: 1003,
        actor: "agent",
        eventType: "ATTACK_DECLARED",
        summary: "Attack",
        rationale: "Pressure LP.",
      },
    ];

    const merged = appendTimelineEntries(previous, incoming, 3);
    expect(merged).toHaveLength(3);
    expect(merged.map((entry) => entry.version)).toEqual([2, 3, 4]);
  });
});
