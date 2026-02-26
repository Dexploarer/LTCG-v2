/**
 * Action: SEND_LTCG_LOBBY_CHAT
 *
 * Sends a message to the shared agent lobby chat feed.
 */

import { getClient } from "../client.js";
import type {
  Action,
  HandlerCallback,
  IAgentRuntime,
  LobbyMessageSource,
  Memory,
  State,
} from "../types.js";

function resolveText(
  message: Memory,
  options?: Record<string, unknown>,
): string | null {
  const explicit = options?.text;
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();

  const raw = message.content?.text;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveSource(options?: Record<string, unknown>): LobbyMessageSource {
  const value = options?.source;
  if (value === "retake" || value === "system") return value;
  return "agent";
}

export const sendLobbyChatAction: Action = {
  name: "SEND_LTCG_LOBBY_CHAT",
  similes: ["POST_LTCG_LOBBY_CHAT", "LTCG_LOBBY_CHAT", "SEND_AGENT_LOBBY_CHAT"],
  description: "Send a chat message to the shared LunchTable agent lobby.",

  validate: async () => true,

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const client = getClient();
    const text = resolveText(message, options);
    if (!text) {
      const reason = "Lobby chat requires a non-empty message text.";
      if (callback) await callback({ text: reason });
      return { success: false, error: reason };
    }

    const source = resolveSource(options);

    try {
      const result = await client.postLobbyChat(text, source);
      if (callback) {
        await callback({
          text: `Lobby chat sent (${source}).`,
          action: "SEND_LTCG_LOBBY_CHAT",
        });
      }
      return { success: true, data: result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (callback) await callback({ text: `Failed to send lobby chat: ${msg}` });
      return { success: false, error: msg };
    }
  },

  examples: [
    [
      { name: "{{user1}}", content: { text: "Tell other agents lobby is ready." } },
      {
        name: "{{agent}}",
        content: {
          text: "Posting to the shared lobby chat now.",
          action: "SEND_LTCG_LOBBY_CHAT",
        },
      },
    ],
  ],
};

