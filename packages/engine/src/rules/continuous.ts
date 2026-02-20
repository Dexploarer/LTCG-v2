/**
 * continuous.ts
 *
 * Handles persistent effects from continuous spells, continuous traps, and field spells.
 *
 * - applyContinuousEffects: scans all face-up continuous/field cards and applies
 *   stat modifiers to eligible monsters, avoiding double-stacking via lingeringEffects.
 * - removeContinuousEffects: reverses all lingering effects from a specific source card
 *   when it leaves the field.
 */

import type { GameState, Seat, BoardCard, SpellTrapCard } from "../types/state.js";
import type { EngineEvent } from "../types/events.js";
import type { CardDefinition, EffectAction } from "../types/cards.js";
import { opponentSeat } from "./phases.js";

// ── Helpers ─────────────────────────────────────────────────────

interface ContinuousSource {
  card: SpellTrapCard;
  definition: CardDefinition;
  seat: Seat;
  isField: boolean;
}

/**
 * Gather all face-up continuous spells, continuous traps, and field spells
 * from both players.
 */
function gatherContinuousSources(state: GameState): ContinuousSource[] {
  const sources: ContinuousSource[] = [];

  for (const seat of ["host", "away"] as const) {
    const spellTrapZone = seat === "host" ? state.hostSpellTrapZone : state.awaySpellTrapZone;
    const fieldSpell = seat === "host" ? state.hostFieldSpell : state.awayFieldSpell;

    // Check spell/trap zone for face-up continuous spells and continuous traps
    for (const stCard of spellTrapZone) {
      if (stCard.faceDown || !stCard.activated) continue;

      const def = state.cardLookup[stCard.definitionId];
      if (!def) continue;

      const isContinuousSpell = def.type === "spell" && def.spellType === "continuous";
      const isContinuousTrap = def.type === "trap" && def.trapType === "continuous";

      if (isContinuousSpell || isContinuousTrap) {
        sources.push({ card: stCard, definition: def, seat, isField: false });
      }
    }

    // Check field spell slot
    if (fieldSpell && !fieldSpell.faceDown && fieldSpell.activated) {
      const def = state.cardLookup[fieldSpell.definitionId];
      if (def && def.type === "spell" && def.spellType === "field") {
        sources.push({ card: fieldSpell, definition: def, seat, isField: true });
      }
    }
  }

  return sources;
}

/**
 * Determine which monsters a continuous/field effect should target based on
 * the effect's target filter and the source's owner.
 *
 * For field spells: typically affect all monsters matching an attribute filter.
 * For continuous spells/traps: typically affect own monsters (or all, depending on filter).
 */
function getAffectedMonsters(
  state: GameState,
  source: ContinuousSource,
  action: EffectAction,
): BoardCard[] {
  if (action.type !== "boost_attack" && action.type !== "boost_defense") {
    return [];
  }

  const monsters: BoardCard[] = [];

  if (source.isField) {
    // Field spells: check the card definition's effect targetFilter
    // If no filter specified, affect all of the controller's monsters
    const effect = source.definition.effects?.[0];
    const filter = effect?.targetFilter;

    const seatsToCheck: Seat[] = [];
    if (!filter?.owner || filter.owner === "self" || filter.owner === "any") {
      seatsToCheck.push(source.seat);
    }
    if (filter?.owner === "opponent" || filter?.owner === "any") {
      seatsToCheck.push(opponentSeat(source.seat));
    }
    // Default: if no owner specified, affect own monsters only
    if (!filter?.owner) {
      // Already added source.seat above
    }

    for (const checkSeat of seatsToCheck) {
      const board = checkSeat === "host" ? state.hostBoard : state.awayBoard;
      for (const monster of board) {
        if (monster.faceDown) continue;

        // Attribute filter check
        if (filter?.attribute) {
          const monsterDef = state.cardLookup[monster.definitionId];
          if (!monsterDef || monsterDef.attribute !== filter.attribute) continue;
        }

        monsters.push(monster);
      }
    }
  } else {
    // Continuous spells/traps: apply to own board monsters by default
    const effect = source.definition.effects?.[0];
    const filter = effect?.targetFilter;

    const seatsToCheck: Seat[] = [];
    if (!filter?.owner || filter.owner === "self") {
      seatsToCheck.push(source.seat);
    }
    if (filter?.owner === "opponent") {
      seatsToCheck.push(opponentSeat(source.seat));
    }
    if (filter?.owner === "any") {
      seatsToCheck.push(source.seat);
      seatsToCheck.push(opponentSeat(source.seat));
    }

    for (const checkSeat of seatsToCheck) {
      const board = checkSeat === "host" ? state.hostBoard : state.awayBoard;
      for (const monster of board) {
        if (monster.faceDown) continue;

        // Attribute filter check
        if (filter?.attribute) {
          const monsterDef = state.cardLookup[monster.definitionId];
          if (!monsterDef || monsterDef.attribute !== filter.attribute) continue;
        }

        monsters.push(monster);
      }
    }
  }

  return monsters;
}

// ── Main API ────────────────────────────────────────────────────

/**
 * Scan all continuous sources and produce CONTINUOUS_EFFECT_APPLIED events
 * for any monster that should receive a modifier but doesn't have one tracked
 * in lingeringEffects yet.
 *
 * Also produces CONTINUOUS_EFFECT_REMOVED events for lingering effects whose
 * target is no longer on the board.
 *
 * This function is idempotent: calling it multiple times won't double-stack
 * because it checks lingeringEffects before applying.
 */
export function applyContinuousEffects(state: GameState): EngineEvent[] {
  const events: EngineEvent[] = [];
  const sources = gatherContinuousSources(state);

  // Build a set of all monster cardIds currently on the board
  const allBoardCardIds = new Set<string>();
  for (const monster of state.hostBoard) allBoardCardIds.add(monster.cardId);
  for (const monster of state.awayBoard) allBoardCardIds.add(monster.cardId);

  // Build a set of active source cardIds
  const activeSourceIds = new Set<string>();
  for (const source of sources) activeSourceIds.add(source.card.cardId);

  // Phase 1: Remove lingering effects for cards no longer on the board
  // or sources that are no longer active
  for (const le of state.lingeringEffects) {
    if (!allBoardCardIds.has(le.targetCardId) || !activeSourceIds.has(le.sourceCardId)) {
      events.push({
        type: "CONTINUOUS_EFFECT_REMOVED",
        sourceCardId: le.sourceCardId,
        targetCardId: le.targetCardId,
        effectType: le.effectType,
        amount: le.amount,
      });
    }
  }

  // Phase 2: Apply new effects for eligible monsters that don't have a
  // lingering effect from this source yet
  for (const source of sources) {
    if (!source.definition.effects) continue;

    for (const effect of source.definition.effects) {
      // Only handle continuous-type effects or effects that have stat-boosting actions
      for (const action of effect.actions) {
        if (action.type !== "boost_attack" && action.type !== "boost_defense") continue;

        const effectType = action.type === "boost_attack" ? "boost_attack" : "boost_defense";
        const monsters = getAffectedMonsters(state, source, action);

        for (const monster of monsters) {
          // Check if we already have this lingering effect
          const alreadyApplied = state.lingeringEffects.some(
            (le) =>
              le.sourceCardId === source.card.cardId &&
              le.targetCardId === monster.cardId &&
              le.effectType === effectType
          );

          if (!alreadyApplied) {
            events.push({
              type: "CONTINUOUS_EFFECT_APPLIED",
              sourceCardId: source.card.cardId,
              sourceSeat: source.seat,
              targetCardId: monster.cardId,
              effectType,
              amount: action.amount,
            });
          }
        }
      }
    }
  }

  return events;
}

/**
 * Generate CONTINUOUS_EFFECT_REMOVED events for all lingering effects
 * tied to a specific source card. Used when a continuous/field card
 * leaves the field.
 */
export function removeContinuousEffectsForSource(
  state: GameState,
  sourceCardId: string,
): EngineEvent[] {
  const events: EngineEvent[] = [];

  for (const le of state.lingeringEffects) {
    if (le.sourceCardId === sourceCardId) {
      events.push({
        type: "CONTINUOUS_EFFECT_REMOVED",
        sourceCardId: le.sourceCardId,
        targetCardId: le.targetCardId,
        effectType: le.effectType,
        amount: le.amount,
      });
    }
  }

  return events;
}
