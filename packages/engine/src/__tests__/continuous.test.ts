/**
 * continuous.test.ts
 *
 * Tests for the continuous effects system: applyContinuousEffects and
 * removeContinuousEffectsForSource.
 */

import { describe, it, expect } from "vitest";
import {
  applyContinuousEffects,
  removeContinuousEffectsForSource,
} from "../rules/continuous.js";
import type { GameState, BoardCard, SpellTrapCard, LingeringEffect } from "../types/state.js";
import type { CardDefinition } from "../types/cards.js";
import type { EngineConfig } from "../types/config.js";

// ── Helpers ───────────────────────────────────────────────────

const DEFAULT_CONFIG: EngineConfig = {
  startingLP: 8000,
  deckSize: { min: 40, max: 60 },
  maxHandSize: 7,
  maxBoardSlots: 3,
  maxSpellTrapSlots: 3,
  startingHandSize: 5,
  breakdownThreshold: 3,
  maxBreakdownsToWin: 3,
  pongEnabled: false,
  redemptionEnabled: false,
  redemptionLP: 5000,
};

function createBoardCard(overrides: Partial<BoardCard> = {}): BoardCard {
  return {
    cardId: "card-1",
    definitionId: "def-1",
    position: "attack",
    faceDown: false,
    canAttack: true,
    hasAttackedThisTurn: false,
    changedPositionThisTurn: false,
    viceCounters: 0,
    temporaryBoosts: { attack: 0, defense: 0 },
    equippedCards: [],
    turnSummoned: 1,
    ...overrides,
  };
}

function createSpellTrapCard(overrides: Partial<SpellTrapCard> = {}): SpellTrapCard {
  return {
    cardId: "spell-1",
    definitionId: "spell-def-1",
    faceDown: false,
    activated: false,
    ...overrides,
  };
}

function createMinimalState(overrides: Partial<GameState> = {}): GameState {
  return {
    config: DEFAULT_CONFIG,
    cardLookup: {},
    hostId: "host-player",
    awayId: "away-player",
    hostHand: [],
    awayHand: [],
    hostBoard: [],
    awayBoard: [],
    hostSpellTrapZone: [],
    awaySpellTrapZone: [],
    hostFieldSpell: null,
    awayFieldSpell: null,
    hostDeck: [],
    awayDeck: [],
    hostGraveyard: [],
    awayGraveyard: [],
    hostBanished: [],
    awayBanished: [],
    hostLifePoints: 8000,
    awayLifePoints: 8000,
    hostBreakdownsCaused: 0,
    awayBreakdownsCaused: 0,
    currentTurnPlayer: "host",
    turnNumber: 1,
    currentPhase: "main",
    hostNormalSummonedThisTurn: false,
    awayNormalSummonedThisTurn: false,
    currentChain: [],
    negatedLinks: [],
    currentPriorityPlayer: null,
    currentChainPasser: null,
    pendingAction: null,
    temporaryModifiers: [],
    lingeringEffects: [],
    optUsedThisTurn: [],
    hoptUsedEffects: [],
    winner: null,
    winReason: null,
    gameOver: false,
    gameStarted: true,
    pendingPong: null,
    pendingRedemption: null,
    redemptionUsed: { host: false, away: false },
    ...overrides,
  };
}

// ── applyContinuousEffects ─────────────────────────────────────

describe("applyContinuousEffects", () => {
  it("continuous spell applies boost to own monsters", () => {
    const continuousSpellDef: CardDefinition = {
      id: "cont-spell-def",
      name: "Power Aura",
      type: "spell",
      description: "All your monsters gain 500 ATK",
      rarity: "common",
      spellType: "continuous",
      effects: [
        {
          id: "eff-0",
          type: "continuous",
          description: "Boost attack",
          actions: [{ type: "boost_attack", amount: 500, duration: "permanent" }],
          targetFilter: { owner: "self" },
        },
      ],
    };

    const monster = createBoardCard({ cardId: "monster-1", definitionId: "monster-def-1" });
    const contSpell = createSpellTrapCard({
      cardId: "cont-spell-1",
      definitionId: "cont-spell-def",
      faceDown: false,
      activated: true,
    });

    const state = createMinimalState({
      cardLookup: {
        "cont-spell-def": continuousSpellDef,
        "monster-def-1": {
          id: "monster-def-1",
          name: "Test Monster",
          type: "stereotype",
          description: "",
          rarity: "common",
          attribute: "fire",
          level: 4,
          attack: 1500,
          defense: 1200,
        },
      },
      hostBoard: [monster],
      hostSpellTrapZone: [contSpell],
    });

    const events = applyContinuousEffects(state);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "CONTINUOUS_EFFECT_APPLIED",
      sourceCardId: "cont-spell-1",
      sourceSeat: "host",
      targetCardId: "monster-1",
      effectType: "boost_attack",
      amount: 500,
    });
  });

  it("field spell applies boost to matching monsters", () => {
    const fieldSpellDef: CardDefinition = {
      id: "field-spell-def",
      name: "Fire Arena",
      type: "spell",
      description: "All fire monsters gain 300 ATK",
      rarity: "common",
      spellType: "field",
      effects: [
        {
          id: "eff-0",
          type: "continuous",
          description: "Boost fire monsters",
          actions: [{ type: "boost_attack", amount: 300, duration: "permanent" }],
          targetFilter: { owner: "self", attribute: "fire" },
        },
      ],
    };

    const fireMonster = createBoardCard({
      cardId: "fire-monster",
      definitionId: "fire-monster-def",
    });
    const waterMonster = createBoardCard({
      cardId: "water-monster",
      definitionId: "water-monster-def",
    });

    const fieldSpell = createSpellTrapCard({
      cardId: "field-1",
      definitionId: "field-spell-def",
      faceDown: false,
      activated: true,
    });

    const state = createMinimalState({
      cardLookup: {
        "field-spell-def": fieldSpellDef,
        "fire-monster-def": {
          id: "fire-monster-def",
          name: "Fire Beast",
          type: "stereotype",
          description: "",
          rarity: "common",
          attribute: "fire",
          level: 4,
          attack: 1500,
          defense: 1200,
        },
        "water-monster-def": {
          id: "water-monster-def",
          name: "Water Beast",
          type: "stereotype",
          description: "",
          rarity: "common",
          attribute: "water",
          level: 4,
          attack: 1400,
          defense: 1300,
        },
      },
      hostBoard: [fireMonster, waterMonster],
      hostFieldSpell: fieldSpell,
    });

    const events = applyContinuousEffects(state);

    // Only fire monster should get the boost
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "CONTINUOUS_EFFECT_APPLIED",
      targetCardId: "fire-monster",
      effectType: "boost_attack",
      amount: 300,
    });
  });

  it("boost is removed when source leaves field (via lingering cleanup)", () => {
    // Monster has a lingering effect from a source that is no longer on the field
    const state = createMinimalState({
      cardLookup: {},
      hostBoard: [
        createBoardCard({ cardId: "monster-1", definitionId: "m-def-1" }),
      ],
      // No continuous sources on field
      hostSpellTrapZone: [],
      lingeringEffects: [
        {
          sourceCardId: "removed-spell",
          effectType: "boost_attack",
          amount: 500,
          targetCardId: "monster-1",
          sourceSeat: "host",
        },
      ],
    });

    const events = applyContinuousEffects(state);

    // The lingering effect should be removed because source "removed-spell" is gone
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "CONTINUOUS_EFFECT_REMOVED",
      sourceCardId: "removed-spell",
      targetCardId: "monster-1",
      effectType: "boost_attack",
      amount: 500,
    });
  });

  it("new monster summoned gets existing continuous boost on next call", () => {
    const continuousSpellDef: CardDefinition = {
      id: "cont-spell-def",
      name: "Power Aura",
      type: "spell",
      description: "All your monsters gain 400 ATK",
      rarity: "common",
      spellType: "continuous",
      effects: [
        {
          id: "eff-0",
          type: "continuous",
          description: "Boost attack",
          actions: [{ type: "boost_attack", amount: 400, duration: "permanent" }],
          targetFilter: { owner: "self" },
        },
      ],
    };

    const oldMonster = createBoardCard({ cardId: "old-monster", definitionId: "m-def" });
    const newMonster = createBoardCard({ cardId: "new-monster", definitionId: "m-def" });
    const contSpell = createSpellTrapCard({
      cardId: "cont-spell-1",
      definitionId: "cont-spell-def",
      faceDown: false,
      activated: true,
    });

    const state = createMinimalState({
      cardLookup: {
        "cont-spell-def": continuousSpellDef,
        "m-def": {
          id: "m-def",
          name: "Test Monster",
          type: "stereotype",
          description: "",
          rarity: "common",
          attribute: "fire",
          level: 4,
          attack: 1500,
          defense: 1200,
        },
      },
      hostBoard: [oldMonster, newMonster],
      hostSpellTrapZone: [contSpell],
      // Old monster already has the lingering effect
      lingeringEffects: [
        {
          sourceCardId: "cont-spell-1",
          effectType: "boost_attack",
          amount: 400,
          targetCardId: "old-monster",
          sourceSeat: "host",
        },
      ],
    });

    const events = applyContinuousEffects(state);

    // Only the new monster should get a new effect (old one is already tracked)
    const applyEvents = events.filter((e) => e.type === "CONTINUOUS_EFFECT_APPLIED");
    expect(applyEvents).toHaveLength(1);
    expect(applyEvents[0]).toMatchObject({
      targetCardId: "new-monster",
      amount: 400,
    });
  });

  it("monster destroyed has its lingering effect cleaned up", () => {
    // A lingering effect references a monster that's no longer on the board
    const state = createMinimalState({
      cardLookup: {
        "cont-spell-def": {
          id: "cont-spell-def",
          name: "Power Aura",
          type: "spell",
          description: "",
          rarity: "common",
          spellType: "continuous",
          effects: [
            {
              id: "eff-0",
              type: "continuous",
              description: "Boost",
              actions: [{ type: "boost_attack", amount: 500, duration: "permanent" }],
              targetFilter: { owner: "self" },
            },
          ],
        },
      },
      hostBoard: [], // Monster was destroyed
      hostSpellTrapZone: [
        createSpellTrapCard({
          cardId: "cont-spell-1",
          definitionId: "cont-spell-def",
          faceDown: false,
          activated: true,
        }),
      ],
      lingeringEffects: [
        {
          sourceCardId: "cont-spell-1",
          effectType: "boost_attack",
          amount: 500,
          targetCardId: "destroyed-monster",
          sourceSeat: "host",
        },
      ],
    });

    const events = applyContinuousEffects(state);

    const removeEvents = events.filter((e) => e.type === "CONTINUOUS_EFFECT_REMOVED");
    expect(removeEvents).toHaveLength(1);
    expect(removeEvents[0]).toMatchObject({
      sourceCardId: "cont-spell-1",
      targetCardId: "destroyed-monster",
    });
  });

  it("no double-stacking on repeated phase transitions", () => {
    const continuousSpellDef: CardDefinition = {
      id: "cont-spell-def",
      name: "Power Aura",
      type: "spell",
      description: "",
      rarity: "common",
      spellType: "continuous",
      effects: [
        {
          id: "eff-0",
          type: "continuous",
          description: "",
          actions: [{ type: "boost_attack", amount: 500, duration: "permanent" }],
          targetFilter: { owner: "self" },
        },
      ],
    };

    const monster = createBoardCard({ cardId: "monster-1", definitionId: "m-def" });
    const contSpell = createSpellTrapCard({
      cardId: "cont-spell-1",
      definitionId: "cont-spell-def",
      faceDown: false,
      activated: true,
    });

    const state = createMinimalState({
      cardLookup: {
        "cont-spell-def": continuousSpellDef,
        "m-def": {
          id: "m-def",
          name: "Test",
          type: "stereotype",
          description: "",
          rarity: "common",
        },
      },
      hostBoard: [monster],
      hostSpellTrapZone: [contSpell],
      // Effect already tracked — simulate a second call
      lingeringEffects: [
        {
          sourceCardId: "cont-spell-1",
          effectType: "boost_attack",
          amount: 500,
          targetCardId: "monster-1",
          sourceSeat: "host",
        },
      ],
    });

    const events = applyContinuousEffects(state);

    // No new CONTINUOUS_EFFECT_APPLIED events — already applied
    const applyEvents = events.filter((e) => e.type === "CONTINUOUS_EFFECT_APPLIED");
    expect(applyEvents).toHaveLength(0);
  });

  it("multiple continuous effects stack correctly", () => {
    const spell1Def: CardDefinition = {
      id: "spell-1-def",
      name: "ATK Boost",
      type: "spell",
      description: "",
      rarity: "common",
      spellType: "continuous",
      effects: [
        {
          id: "eff-0",
          type: "continuous",
          description: "",
          actions: [{ type: "boost_attack", amount: 300, duration: "permanent" }],
          targetFilter: { owner: "self" },
        },
      ],
    };

    const spell2Def: CardDefinition = {
      id: "spell-2-def",
      name: "DEF Boost",
      type: "spell",
      description: "",
      rarity: "common",
      spellType: "continuous",
      effects: [
        {
          id: "eff-0",
          type: "continuous",
          description: "",
          actions: [{ type: "boost_defense", amount: 200, duration: "permanent" }],
          targetFilter: { owner: "self" },
        },
      ],
    };

    const monster = createBoardCard({ cardId: "monster-1", definitionId: "m-def" });

    const state = createMinimalState({
      cardLookup: {
        "spell-1-def": spell1Def,
        "spell-2-def": spell2Def,
        "m-def": {
          id: "m-def",
          name: "Test",
          type: "stereotype",
          description: "",
          rarity: "common",
        },
      },
      hostBoard: [monster],
      hostSpellTrapZone: [
        createSpellTrapCard({
          cardId: "spell-1",
          definitionId: "spell-1-def",
          faceDown: false,
          activated: true,
        }),
        createSpellTrapCard({
          cardId: "spell-2",
          definitionId: "spell-2-def",
          faceDown: false,
          activated: true,
        }),
      ],
    });

    const events = applyContinuousEffects(state);

    // Both effects should be applied
    expect(events).toHaveLength(2);
    const attackBoost = events.find(
      (e) => e.type === "CONTINUOUS_EFFECT_APPLIED" && e.effectType === "boost_attack",
    );
    const defenseBoost = events.find(
      (e) => e.type === "CONTINUOUS_EFFECT_APPLIED" && e.effectType === "boost_defense",
    );
    expect(attackBoost).toBeDefined();
    expect(defenseBoost).toBeDefined();
    expect(attackBoost!.amount).toBe(300);
    expect(defenseBoost!.amount).toBe(200);
  });

  it("replacing field spell removes old effects and applies new ones", () => {
    const oldFieldDef: CardDefinition = {
      id: "old-field-def",
      name: "Old Field",
      type: "spell",
      description: "",
      rarity: "common",
      spellType: "field",
      effects: [
        {
          id: "eff-0",
          type: "continuous",
          description: "",
          actions: [{ type: "boost_attack", amount: 200, duration: "permanent" }],
          targetFilter: { owner: "self" },
        },
      ],
    };

    const newFieldDef: CardDefinition = {
      id: "new-field-def",
      name: "New Field",
      type: "spell",
      description: "",
      rarity: "common",
      spellType: "field",
      effects: [
        {
          id: "eff-0",
          type: "continuous",
          description: "",
          actions: [{ type: "boost_defense", amount: 400, duration: "permanent" }],
          targetFilter: { owner: "self" },
        },
      ],
    };

    const monster = createBoardCard({ cardId: "monster-1", definitionId: "m-def" });

    // State: new field spell is active, old one has lingering effects
    const state = createMinimalState({
      cardLookup: {
        "old-field-def": oldFieldDef,
        "new-field-def": newFieldDef,
        "m-def": {
          id: "m-def",
          name: "Test",
          type: "stereotype",
          description: "",
          rarity: "common",
        },
      },
      hostBoard: [monster],
      hostFieldSpell: createSpellTrapCard({
        cardId: "new-field-1",
        definitionId: "new-field-def",
        faceDown: false,
        activated: true,
      }),
      lingeringEffects: [
        {
          sourceCardId: "old-field-1", // old field is no longer on the board
          effectType: "boost_attack",
          amount: 200,
          targetCardId: "monster-1",
          sourceSeat: "host",
        },
      ],
    });

    const events = applyContinuousEffects(state);

    // Old effect removed
    const removeEvents = events.filter((e) => e.type === "CONTINUOUS_EFFECT_REMOVED");
    expect(removeEvents).toHaveLength(1);
    expect(removeEvents[0]).toMatchObject({
      sourceCardId: "old-field-1",
      targetCardId: "monster-1",
      effectType: "boost_attack",
    });

    // New effect applied
    const applyEvents = events.filter((e) => e.type === "CONTINUOUS_EFFECT_APPLIED");
    expect(applyEvents).toHaveLength(1);
    expect(applyEvents[0]).toMatchObject({
      sourceCardId: "new-field-1",
      targetCardId: "monster-1",
      effectType: "boost_defense",
      amount: 400,
    });
  });
});

// ── removeContinuousEffectsForSource ────────────────────────────

describe("removeContinuousEffectsForSource", () => {
  it("removes all lingering effects from the specified source", () => {
    const state = createMinimalState({
      lingeringEffects: [
        {
          sourceCardId: "spell-A",
          effectType: "boost_attack",
          amount: 300,
          targetCardId: "monster-1",
          sourceSeat: "host",
        },
        {
          sourceCardId: "spell-A",
          effectType: "boost_defense",
          amount: 200,
          targetCardId: "monster-2",
          sourceSeat: "host",
        },
        {
          sourceCardId: "spell-B",
          effectType: "boost_attack",
          amount: 100,
          targetCardId: "monster-1",
          sourceSeat: "host",
        },
      ],
    });

    const events = removeContinuousEffectsForSource(state, "spell-A");

    expect(events).toHaveLength(2);
    expect(events.every((e) => e.type === "CONTINUOUS_EFFECT_REMOVED")).toBe(true);
    expect(events.every((e) => e.sourceCardId === "spell-A")).toBe(true);
  });

  it("returns empty array when no effects from that source exist", () => {
    const state = createMinimalState({
      lingeringEffects: [
        {
          sourceCardId: "spell-B",
          effectType: "boost_attack",
          amount: 100,
          targetCardId: "monster-1",
          sourceSeat: "host",
        },
      ],
    });

    const events = removeContinuousEffectsForSource(state, "nonexistent-spell");

    expect(events).toHaveLength(0);
  });

  it("returns empty array when no lingering effects exist at all", () => {
    const state = createMinimalState({
      lingeringEffects: [],
    });

    const events = removeContinuousEffectsForSource(state, "any-card");

    expect(events).toHaveLength(0);
  });
});
