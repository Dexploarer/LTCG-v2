import { describe, expect, it } from "vitest";
import { parseLogEntries } from "./GameLog";

function makeBatch(command: string, seat: "host" | "away", version: number) {
  return {
    command,
    events: "[]",
    seat,
    version,
    createdAt: Date.now(),
  };
}

describe("parseLogEntries", () => {
  it("renders redacted hidden setup commands with the expected label", () => {
    const entries = parseLogEntries(
      [makeBatch(JSON.stringify({ type: "SET_MONSTER" }), "away", 1)],
      "host",
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]?.text).toBe("SET A STEREOTYPE");
    expect(entries[0]?.actor).toBe("opponent");
  });

  it("ignores malformed or unknown commands without crashing", () => {
    const batches = [
      makeBatch("{", "away", 1),
      makeBatch(JSON.stringify({ type: "UNKNOWN" }), "away", 2),
      makeBatch(JSON.stringify({ type: "END_TURN" }), "host", 3),
    ];

    expect(() => parseLogEntries(batches, "host")).not.toThrow();

    const entries = parseLogEntries(batches, "host");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.text).toBe("END TURN");
    expect(entries[0]?.actor).toBe("you");
  });
});
