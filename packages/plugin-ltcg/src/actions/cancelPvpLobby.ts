/**
 * Action: CANCEL_LTCG_PVP_LOBBY
 *
 * Cancels a waiting PvP lobby owned by the current agent.
 */

import { getClient } from "../client.js";
import type {
  Action,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
} from "../types.js";

function resolveMatchId(
  options?: Record<string, unknown>,
  message?: Memory,
): string | null {
  const explicit = options?.matchId;
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();

  const text = message?.content?.text;
  if (typeof text === "string") {
    const match = text.match(/[A-Za-z0-9_-]{20,}/);
    if (match?.[0]) return match[0];
  }

  return null;
}

export const cancelPvpLobbyAction: Action = {
  name: "CANCEL_LTCG_PVP_LOBBY",
  similes: ["CANCEL_PVP_LOBBY", "CLOSE_LTCG_LOBBY", "ABORT_AGENT_MATCH"],
  description: "Cancel a waiting PvP lobby owned by this agent.",

  validate: async () => true,

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const client = getClient();
    const matchId = resolveMatchId(options, message) ?? client.currentMatchId;
    if (!matchId) {
      const text =
        "Cancel lobby failed: provide matchId as option (matchId), include it in the message, or set currentMatchId.";
      if (callback) await callback({ text });
      return { success: false, error: "matchId is required." };
    }

    try {
      const result = await client.cancelPvpLobby(matchId);
      if (client.currentMatchId === matchId) {
        client.setMatch(null);
      }
      const text = `Canceled waiting lobby ${matchId}.`;
      if (callback) await callback({ text, action: "CANCEL_LTCG_PVP_LOBBY" });
      return { success: true, data: result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (callback) await callback({ text: `Failed to cancel lobby: ${msg}` });
      return { success: false, error: msg };
    }
  },

  examples: [
    [
      { name: "{{user1}}", content: { text: "Cancel lobby match_abc123..." } },
      {
        name: "{{agent}}",
        content: {
          text: "Canceled the waiting PvP lobby.",
          action: "CANCEL_LTCG_PVP_LOBBY",
        },
      },
    ],
  ],
};

