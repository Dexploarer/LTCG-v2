import { describe, expect, it } from "vitest";
import {
  buildStreamOverlaySearch,
  buildStreamOverlayUrl,
  normalizeStreamOverlaySeat,
  parseStreamOverlayParams,
} from "./streamOverlayParams";

describe("normalizeStreamOverlaySeat", () => {
  it("returns null for missing values", () => {
    expect(normalizeStreamOverlaySeat(null)).toBeNull();
    expect(normalizeStreamOverlaySeat("")).toBeNull();
    expect(normalizeStreamOverlaySeat("   ")).toBeNull();
  });

  it("accepts host/away values", () => {
    expect(normalizeStreamOverlaySeat("host")).toBe("host");
    expect(normalizeStreamOverlaySeat("away")).toBe("away");
    expect(normalizeStreamOverlaySeat("HOST")).toBe("host");
  });

  it("normalizes invalid values to host", () => {
    expect(normalizeStreamOverlaySeat("invalid")).toBe("host");
    expect(normalizeStreamOverlaySeat("spectator")).toBe("host");
  });
});

describe("parseStreamOverlayParams", () => {
  it("parses and trims selector params", () => {
    const params = new URLSearchParams(
      "apiUrl=https://example.convex.site&apiKey=ltcg_key_1&hostId=user_42&matchId=match_7&seat=away",
    );
    expect(parseStreamOverlayParams(params)).toEqual({
      apiUrl: "https://example.convex.site",
      apiKey: "ltcg_key_1",
      hostId: "user_42",
      matchId: "match_7",
      seat: "away",
    });
  });

  it("normalizes empty values to null", () => {
    const params = new URLSearchParams("apiKey=%20%20&hostId=&matchId=&seat=");
    expect(parseStreamOverlayParams(params)).toEqual({
      apiUrl: null,
      apiKey: null,
      hostId: null,
      matchId: null,
      seat: null,
    });
  });

  it("normalizes invalid seat values to host", () => {
    const params = new URLSearchParams("seat=nonsense");
    expect(parseStreamOverlayParams(params).seat).toBe("host");
  });
});

describe("buildStreamOverlaySearch", () => {
  it("serializes trimmed selector params in a deterministic order", () => {
    expect(
      buildStreamOverlaySearch({
        apiUrl: " https://example.convex.site/ ",
        apiKey: "  ltcg_key_1  ",
        hostId: " user_1 ",
        matchId: " match_1 ",
        seat: "away",
      }),
    ).toBe(
      "apiUrl=https%3A%2F%2Fexample.convex.site%2F&apiKey=ltcg_key_1&hostId=user_1&matchId=match_1&seat=away",
    );
  });

  it("drops empty values and normalizes invalid seat values", () => {
    expect(
      buildStreamOverlaySearch({
        apiKey: "   ",
        matchId: "match_22",
        seat: "invalid",
      }),
    ).toBe("matchId=match_22&seat=host");
  });
});

describe("buildStreamOverlayUrl", () => {
  it("returns the base stream overlay route when no selectors are provided", () => {
    expect(buildStreamOverlayUrl({})).toBe("/stream-overlay");
  });

  it("returns stream overlay with query string when selectors are present", () => {
    expect(
      buildStreamOverlayUrl({
        matchId: "match_88",
        seat: "host",
      }),
    ).toBe("/stream-overlay?matchId=match_88&seat=host");
  });
});
