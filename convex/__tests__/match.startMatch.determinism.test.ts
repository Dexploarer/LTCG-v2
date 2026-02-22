/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { buildCardLookup, createInitialState, DEFAULT_CONFIG } from "@lunchtable/engine";
import { buildMatchSeed, makeRng } from "../agentSeed";

function buildDeck(prefix: string, size = 40): string[] {
  return Array.from({ length: size }, (_, index) => `${prefix}_${index + 1}`);
}

function buildLookup(ids: string[]) {
  return buildCardLookup(
    ids.map((id) => ({
      _id: id,
      name: id,
      cardType: "stereotype",
      rarity: "common",
      level: 4,
      attack: 1000,
      defense: 1000,
      isActive: true,
      abilities: "",
      // Extra fields in seed rows are ignored by buildCardLookup.
    })) as any,
  );
}

describe("start match determinism", () => {
  test("same seed yields identical opening state and first player", () => {
    const hostDeck = buildDeck("host");
    const awayDeck = buildDeck("away");
    const lookup = buildLookup([...hostDeck, ...awayDeck]);
    const seed = buildMatchSeed([
      "convex.match.startMatch",
      "host-user",
      "away-user",
      hostDeck.length,
      awayDeck.length,
      hostDeck[0],
      awayDeck[0],
    ]);
    const firstPlayer: "host" | "away" = seed % 2 === 0 ? "host" : "away";

    const stateA = createInitialState(
      lookup,
      DEFAULT_CONFIG,
      "host-user",
      "away-user",
      hostDeck,
      awayDeck,
      firstPlayer,
      makeRng(seed),
    );
    const stateB = createInitialState(
      lookup,
      DEFAULT_CONFIG,
      "host-user",
      "away-user",
      hostDeck,
      awayDeck,
      firstPlayer,
      makeRng(seed),
    );

    expect(stateA.currentTurnPlayer).toBe(firstPlayer);
    expect(stateB.currentTurnPlayer).toBe(firstPlayer);
    expect(stateA.hostHand).toEqual(stateB.hostHand);
    expect(stateA.awayHand).toEqual(stateB.awayHand);
    expect(stateA.hostDeck).toEqual(stateB.hostDeck);
    expect(stateA.awayDeck).toEqual(stateB.awayDeck);
  });

  test("different seeds produce different first player outcomes across sample", () => {
    let hostStarts = 0;
    let awayStarts = 0;

    for (let i = 0; i < 200; i += 1) {
      const seed = buildMatchSeed(["pvp", "host", "away", i]);
      if (seed % 2 === 0) hostStarts += 1;
      else awayStarts += 1;
    }

    expect(hostStarts).toBeGreaterThan(0);
    expect(awayStarts).toBeGreaterThan(0);
    expect(Math.abs(hostStarts - awayStarts)).toBeLessThan(80);
  });
});
