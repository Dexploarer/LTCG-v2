import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLobbySnapshotAction } from "../actions/getLobbySnapshot.js";
import { sendLobbyChatAction } from "../actions/sendLobbyChat.js";

const getLobbySnapshot = vi.fn();
const postLobbyChat = vi.fn();

vi.mock("../client.js", () => ({
  getClient: () => ({
    getLobbySnapshot,
    postLobbyChat,
  }),
}));

describe("lobby actions", () => {
  beforeEach(() => {
    getLobbySnapshot.mockReset();
    postLobbyChat.mockReset();
  });

  it("loads lobby snapshot", async () => {
    getLobbySnapshot.mockResolvedValue({
      currentUser: {
        userId: "user_1",
        username: "agent_1",
        walletAddress: null,
        hasRetakeAccount: false,
        pipelineEnabled: false,
        agentName: null,
        tokenAddress: null,
        tokenTicker: null,
        streamUrl: null,
      },
      openLobbies: [],
      activeStoryMatches: [],
      messages: [],
    });

    const result = await getLobbySnapshotAction.handler(
      { agentId: "agent_1", getSetting: () => undefined } as any,
      { content: { text: "" } } as any,
      undefined,
      { limit: 20 },
      undefined,
    );

    expect(result?.success).toBe(true);
    expect(getLobbySnapshot).toHaveBeenCalledWith(20);
  });

  it("sends lobby chat messages", async () => {
    postLobbyChat.mockResolvedValue({ ok: true, messageId: "msg_1" });
    const callback = vi.fn().mockResolvedValue([]);

    const result = await sendLobbyChatAction.handler(
      { agentId: "agent_1", getSetting: () => undefined } as any,
      { content: { text: "ready to duel" } } as any,
      undefined,
      { source: "agent" },
      callback,
    );

    expect(result?.success).toBe(true);
    expect(postLobbyChat).toHaveBeenCalledWith("ready to duel", "agent");
    expect(callback).toHaveBeenCalled();
  });
});

