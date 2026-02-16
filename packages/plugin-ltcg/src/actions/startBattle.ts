/**
 * Action: START_LTCG_BATTLE
 *
 * Starts a story mode battle, picks the first available chapter, and begins
 * the match using the currently selected active deck.
 */

import { getClient } from "../client.js";
import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from "../types.js";

export const startBattleAction: Action = {
  name: "START_LTCG_BATTLE",
  similes: ["PLAY_LTCG", "START_MATCH", "FIGHT_BATTLE", "PLAY_CARD_GAME"],
  description:
    "Start a LunchTable Trading Card Game story battle against the AI opponent. Only available when no match is active.",

  validate: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
  ) => {
    try {
      return !getClient().hasActiveMatch;
    } catch {
      return false;
    }
  },

  handler: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const client = getClient();

    try {
      const me = await client.getMe();

      // Get first available chapter
      const chapters = await client.getChapters();
      if (!chapters.length) {
        throw new Error("No story chapters available. Run seed first.");
      }
      const chapter = chapters[0];

      // Start the battle
      const result = await client.startBattle(chapter._id, 1);
      client.setMatch(result.matchId);

      const text = `Battle started! Chapter "${chapter.title ?? chapter.name}" as ${me.name}. Match: ${result.matchId}`;
      if (callback) await callback({ text, action: "START_LTCG_BATTLE" });
      return { success: true, data: { matchId: result.matchId } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const text = `Failed to start battle: ${msg}`;
      if (callback) await callback({ text });
      return { success: false, error: msg };
    }
  },

  examples: [
    [
      { name: "{{user1}}", content: { text: "Play a card game" } },
      {
        name: "{{agent}}",
        content: {
          text: "Starting a LunchTable battle!",
          action: "START_LTCG_BATTLE",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "Start a story battle for me" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Let me start a story mode battle!",
          action: "START_LTCG_BATTLE",
        },
      },
    ],
  ],
};
