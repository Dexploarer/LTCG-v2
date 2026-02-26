import { describe, expect, it } from "vitest";
import { shouldAutoUnlockAudioForLocation } from "./AudioProvider";

describe("shouldAutoUnlockAudioForLocation", () => {
  it("auto-unlocks stream overlay routes by default", () => {
    expect(shouldAutoUnlockAudioForLocation("/stream-overlay")).toBe(true);
    expect(shouldAutoUnlockAudioForLocation("/stream-overlay/capture")).toBe(true);
  });

  it("does not auto-unlock non-stream routes unless explicitly enabled", () => {
    expect(shouldAutoUnlockAudioForLocation("/story")).toBe(false);
    expect(shouldAutoUnlockAudioForLocation("/pvp", "?audioAutoplay=1")).toBe(true);
  });

  it("allows explicit disable for stream overlay routes", () => {
    expect(shouldAutoUnlockAudioForLocation("/stream-overlay", "?audioAutoplay=0")).toBe(false);
    expect(
      shouldAutoUnlockAudioForLocation("/stream-overlay", "audioAutoplay=false"),
    ).toBe(false);
  });
});
