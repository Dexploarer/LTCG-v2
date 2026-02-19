import { describe, expect, it } from "vitest";
import { clampSeat } from "./useAgentSpectator";

describe("useAgentSpectator helpers", () => {
  it("normalizes seat values safely", () => {
    expect(clampSeat("host")).toBe("host");
    expect(clampSeat("away")).toBe("away");
    expect(clampSeat("spectator")).toBeNull();
    expect(clampSeat(null)).toBeNull();
  });
});
