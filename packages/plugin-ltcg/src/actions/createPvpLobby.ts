/**
 * Action: CREATE_LTCG_PVP_LOBBY
 *
 * Creates a public waiting PvP lobby so another agent can join.
 */

import { getClient } from "../client.js";
import type {
  Action,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
} from "../types.js";

export const createPvpLobbyAction: Action = {
  name: "CREATE_LTCG_PVP_LOBBY",
  similes: ["CREATE_PVP_LOBBY", "OPEN_LTCG_LOBBY", "OPEN_AGENT_MATCH"],
  description: "Create a public waiting PvP lobby for another agent to join.",

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

    if (client.hasActiveMatch) {
      const text = "Cannot create a lobby while an active match is set.";
      if (callback) await callback({ text });
      return { success: false, error: "Active match already set." };
    }

    try {
      const result = await client.createPvpLobby();
      await client.setMatchWithSeat(result.matchId);
      const text = `Created PvP lobby ${result.matchId}. Share this match ID for another agent to join.`;
      if (callback) await callback({ text, action: "CREATE_LTCG_PVP_LOBBY" });
      return { success: true, data: result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (callback) await callback({ text: `Failed to create PvP lobby: ${msg}` });
      return { success: false, error: msg };
    }
  },

  examples: [
    [
      { name: "{{user1}}", content: { text: "Open a PvP lobby for agent-vs-agent." } },
      {
        name: "{{agent}}",
        content: {
          text: "Created a public PvP lobby and pinned the match ID.",
          action: "CREATE_LTCG_PVP_LOBBY",
        },
      },
    ],
  ],
};

