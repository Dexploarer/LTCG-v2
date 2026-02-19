/**
 * effects.ts
 *
 * High-level effect resolution for the rules layer:
 * - resolveEffectActions: resolve an effect definition's actions into events
 * - canActivateEffect: check OPT/HOPT constraints
 * - detectTriggerEffects: scan events for matching trigger effects on board cards
 */

import type { GameState, Seat } from "../types/state.js";
import type { EngineEvent } from "../types/events.js";
import type { EffectDefinition, EffectAction } from "../types/cards.js";
import { executeAction } from "../effects/operations.js";
import { expectDefined } from "../internal/invariant.js";

/**
 * Resolve an array of EffectActions from an effect definition into EngineEvents.
 *
 * This wraps the lower-level executeAction calls and provides the
 * seat/target context needed for resolution.
 */
export function resolveEffectActions(
  state: GameState,
  seat: Seat,
  actions: EffectAction[],
  sourceCardId: string,
  targets: string[]
): EngineEvent[] {
  const events: EngineEvent[] = [];

  for (const action of actions) {
    const actionEvents = executeAction(state, action, seat, sourceCardId, targets);
    events.push(...actionEvents);
  }

  return events;
}

/**
 * Check whether an effect can be activated given OPT/HOPT constraints.
 *
 * - If oncePerTurn and the effect's id is in state.optUsedThisTurn -> false
 * - If hardOncePerTurn and the effect's id is in state.hoptUsedEffects -> false
 * - Otherwise -> true
 */
export function canActivateEffect(state: GameState, effectDef: EffectDefinition): boolean {
  if (effectDef.oncePerTurn && state.optUsedThisTurn.includes(effectDef.id)) {
    return false;
  }
  if (effectDef.hardOncePerTurn && state.hoptUsedEffects.includes(effectDef.id)) {
    return false;
  }
  return true;
}

/**
 * Scan a list of events for matching trigger effects on board cards.
 *
 * Handles:
 * - MONSTER_SUMMONED / SPECIAL_SUMMONED -> fires on_summon effects
 * - FLIP_SUMMONED -> fires both flip and on_summon effects
 *
 * Returns an array of EFFECT_ACTIVATED events (and their resulting action events)
 * that should be processed by evolve().
 */
export function detectTriggerEffects(state: GameState, events: EngineEvent[]): EngineEvent[] {
  const triggeredEvents: EngineEvent[] = [];

  for (const event of events) {
    const isSummon = event.type === "MONSTER_SUMMONED" || event.type === "SPECIAL_SUMMONED";
    const isFlip = event.type === "FLIP_SUMMONED";

    if (!isSummon && !isFlip) continue;

    const { seat, cardId } = event;
    const cardDef = state.cardLookup[cardId];

    if (!cardDef?.effects) continue;

    for (let i = 0; i < cardDef.effects.length; i++) {
      const eff = expectDefined(
        cardDef.effects[i],
        `rules.effects.detectTriggerEffects missing effect at index ${i}`
      );

      // Match trigger type to event type
      const matchesTrigger =
        (isSummon && eff.type === "on_summon") ||
        (isFlip && (eff.type === "flip" || eff.type === "on_summon"));

      if (!matchesTrigger) continue;

      // Check OPT/HOPT constraints
      if (!canActivateEffect(state, eff)) continue;

      // Emit EFFECT_ACTIVATED event
      triggeredEvents.push({
        type: "EFFECT_ACTIVATED",
        seat,
        cardId,
        effectIndex: i,
        targets: [],
      });

      // Resolve the effect's actions
      const actionEvents = resolveEffectActions(state, seat, eff.actions, cardId, []);
      triggeredEvents.push(...actionEvents);
    }
  }

  return triggeredEvents;
}
