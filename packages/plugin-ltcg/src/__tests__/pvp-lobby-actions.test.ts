import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPvpLobbyAction } from "../actions/createPvpLobby.js";
import { cancelPvpLobbyAction } from "../actions/cancelPvpLobby.js";

const createPvpLobby = vi.fn();
const cancelPvpLobby = vi.fn();
const setMatchWithSeat = vi.fn();
const setMatch = vi.fn();

const mockClient = {
  hasActiveMatch: false,
  currentMatchId: null as string | null,
  createPvpLobby,
  cancelPvpLobby,
  setMatchWithSeat,
  setMatch,
};

vi.mock("../client.js", () => ({
  getClient: () => mockClient,
}));

describe("pvp lobby actions", () => {
  beforeEach(() => {
    mockClient.hasActiveMatch = false;
    mockClient.currentMatchId = null;
    createPvpLobby.mockReset();
    cancelPvpLobby.mockReset();
    setMatchWithSeat.mockReset();
    setMatch.mockReset();
  });

  it("creates a lobby and sets active match state", async () => {
    createPvpLobby.mockResolvedValue({
      matchId: "match_1",
      visibility: "public",
      joinCode: null,
      status: "waiting",
      createdAt: Date.now(),
    });
    const callback = vi.fn().mockResolvedValue([]);

    const result = await createPvpLobbyAction.handler(
      { agentId: "agent_1", getSetting: () => undefined } as any,
      { content: { text: "open lobby" } } as any,
      undefined,
      undefined,
      callback,
    );

    expect(result?.success).toBe(true);
    expect(createPvpLobby).toHaveBeenCalledOnce();
    expect(setMatchWithSeat).toHaveBeenCalledWith("match_1");
    expect(callback).toHaveBeenCalled();
  });

  it("cancels by explicit matchId and clears client match", async () => {
    mockClient.currentMatchId = "match_1";
    cancelPvpLobby.mockResolvedValue({
      matchId: "match_1",
      canceled: true,
      status: "canceled",
    });

    const result = await cancelPvpLobbyAction.handler(
      { agentId: "agent_1", getSetting: () => undefined } as any,
      { content: { text: "" } } as any,
      undefined,
      { matchId: "match_1" },
      undefined,
    );

    expect(result?.success).toBe(true);
    expect(cancelPvpLobby).toHaveBeenCalledWith("match_1");
    expect(setMatch).toHaveBeenCalledWith(null);
  });
});

