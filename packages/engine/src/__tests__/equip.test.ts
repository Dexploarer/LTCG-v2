/**
 * equip.test.ts
 *
 * Tests for equip spell behavior: attachment, stat boost application,
 * destruction when target leaves, and validation requirements.
 */

import { describe, it, expect } from "vitest";
import { decideActivateSpell } from "../rules/spellsTraps.js";
import type { GameState, BoardCard, SpellTrapCard } from "../types/state.js";
import type { CardDefinition } from "../types/cards.js";
import type { EngineConfig } from "../types/config.js";
import type { Command } from "../types/commands.js";

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

const equipSpellDef: CardDefinition = {
  id: "equip-spell-def",
  name: "Power Blade",
  type: "spell",
  description: "Equip to a face-up monster: +500 ATK",
  rarity: "common",
  spellType: "equip",
  effects: [
    {
      id: "eff-0",
      type: "ignition",
      description: "+500 ATK",
      actions: [{ type: "boost_attack", amount: 500, duration: "permanent" }],
    },
  ],
};

const monsterDef: CardDefinition = {
  id: "monster-def",
  name: "Test Warrior",
  type: "stereotype",
  description: "",
  rarity: "common",
  attribute: "fire",
  level: 4,
  attack: 1500,
  defense: 1200,
};

// ── Tests ────────────────────────────────────────────────────

describe("Equip spell: decideActivateSpell", () => {
  it("equip spell attaches to face-up monster (emits SPELL_ACTIVATED + SPELL_EQUIPPED)", () => {
    const monster = createBoardCard({
      cardId: "monster-1",
      definitionId: "monster-def",
    });

    const state = createMinimalState({
      cardLookup: {
        "equip-spell-1": equipSpellDef,
        "monster-def": monsterDef,
      },
      hostHand: ["equip-spell-1"],
      hostBoard: [monster],
    });

    const command: Extract<Command, { type: "ACTIVATE_SPELL" }> = {
      type: "ACTIVATE_SPELL",
      cardId: "equip-spell-1",
      targets: ["monster-1"],
    };

    const events = decideActivateSpell(state, "host", command);

    expect(events.length).toBeGreaterThanOrEqual(2);

    const spellActivated = events.find((e) => e.type === "SPELL_ACTIVATED");
    expect(spellActivated).toBeDefined();

    const spellEquipped = events.find((e) => e.type === "SPELL_EQUIPPED");
    expect(spellEquipped).toBeDefined();
    expect(spellEquipped).toMatchObject({
      type: "SPELL_EQUIPPED",
      seat: "host",
      cardId: "equip-spell-1",
      targetCardId: "monster-1",
    });
  });

  it("equip stat boost applies correctly (boost_attack event emitted)", () => {
    const monster = createBoardCard({
      cardId: "monster-1",
      definitionId: "monster-def",
    });

    const state = createMinimalState({
      cardLookup: {
        "equip-spell-1": equipSpellDef,
        "monster-def": monsterDef,
      },
      hostHand: ["equip-spell-1"],
      hostBoard: [monster],
    });

    const command: Extract<Command, { type: "ACTIVATE_SPELL" }> = {
      type: "ACTIVATE_SPELL",
      cardId: "equip-spell-1",
      targets: ["monster-1"],
    };

    const events = decideActivateSpell(state, "host", command);

    // The effect execution should include a MODIFIER_APPLIED event
    const modifierEvent = events.find((e) => e.type === "MODIFIER_APPLIED");
    expect(modifierEvent).toBeDefined();
    expect(modifierEvent).toMatchObject({
      type: "MODIFIER_APPLIED",
      cardId: "monster-1",
      field: "attack",
      amount: 500,
    });
  });

  it("equip requires a face-up monster target (returns empty when no monsters)", () => {
    const state = createMinimalState({
      cardLookup: {
        "equip-spell-1": equipSpellDef,
      },
      hostHand: ["equip-spell-1"],
      hostBoard: [], // No monsters on board
    });

    const command: Extract<Command, { type: "ACTIVATE_SPELL" }> = {
      type: "ACTIVATE_SPELL",
      cardId: "equip-spell-1",
      targets: [],
    };

    const events = decideActivateSpell(state, "host", command);

    expect(events).toHaveLength(0);
  });

  it("cannot equip without specifying target (returns empty)", () => {
    const monster = createBoardCard({
      cardId: "monster-1",
      definitionId: "monster-def",
    });

    const state = createMinimalState({
      cardLookup: {
        "equip-spell-1": equipSpellDef,
        "monster-def": monsterDef,
      },
      hostHand: ["equip-spell-1"],
      hostBoard: [monster],
    });

    const command: Extract<Command, { type: "ACTIVATE_SPELL" }> = {
      type: "ACTIVATE_SPELL",
      cardId: "equip-spell-1",
      // No targets specified
    };

    const events = decideActivateSpell(state, "host", command);

    // No target means equip can't activate
    expect(events).toHaveLength(0);
  });

  it("equip cannot target face-down monster", () => {
    const faceDownMonster = createBoardCard({
      cardId: "fd-monster",
      definitionId: "monster-def",
      faceDown: true,
    });

    const state = createMinimalState({
      cardLookup: {
        "equip-spell-1": equipSpellDef,
        "monster-def": monsterDef,
      },
      hostHand: ["equip-spell-1"],
      hostBoard: [faceDownMonster],
    });

    const command: Extract<Command, { type: "ACTIVATE_SPELL" }> = {
      type: "ACTIVATE_SPELL",
      cardId: "equip-spell-1",
      targets: ["fd-monster"],
    };

    const events = decideActivateSpell(state, "host", command);

    // Face-down monsters can't be equipped
    expect(events).toHaveLength(0);
  });
});
