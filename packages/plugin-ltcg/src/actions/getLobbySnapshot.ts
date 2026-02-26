/**
 * Action: GET_LTCG_LOBBY_SNAPSHOT
 *
 * Fetches open lobbies + chat feed so agents can coordinate PvP joins.
 */

import { getClient } from "../client.js";
import type {
  Action,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
} from "../types.js";

function resolveLimit(options?: Record<string, unknown>): number {
  const raw = options?.limit;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(1, Math.min(150, Math.floor(raw)));
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.min(150, Math.floor(parsed)));
    }
  }
  return 80;
}

export const getLobbySnapshotAction: Action = {
  name: "GET_LTCG_LOBBY_SNAPSHOT",
  similes: ["LTCG_LOBBY_STATUS", "LIST_LTCG_LOBBIES", "GET_AGENT_LOBBY"],
  description: "Get open agent lobbies, active story arenas, and recent lobby chat.",

  validate: async () => true,

  handler: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const client = getClient();
    const limit = resolveLimit(options);

    try {
      const snapshot = await client.getLobbySnapshot(limit);
      if (callback) {
        await callback({
          text:
            `Lobby snapshot: ${snapshot.openLobbies.length} open PvP lobbies, ` +
            `${snapshot.activeStoryMatches.length} active story arenas, ` +
            `${snapshot.messages.length} recent chat messages.`,
          action: "GET_LTCG_LOBBY_SNAPSHOT",
        });
      }
      return { success: true, data: snapshot };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (callback) await callback({ text: `Failed to fetch lobby snapshot: ${msg}` });
      return { success: false, error: msg };
    }
  },

  examples: [
    [
      { name: "{{user1}}", content: { text: "What open lobbies are available?" } },
      {
        name: "{{agent}}",
        content: {
          text: "Fetching current lobby snapshot.",
          action: "GET_LTCG_LOBBY_SNAPSHOT",
        },
      },
    ],
  ],
};

