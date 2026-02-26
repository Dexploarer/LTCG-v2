import { beforeEach, describe, expect, it, vi } from "vitest";
import { LTCGClient } from "../client.js";

function mockJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("LTCGClient agent control endpoints", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("calls lobby snapshot endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
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
      }),
    );

    const client = new LTCGClient("https://example.convex.site/", "ltcg_test_key");
    await client.getLobbySnapshot();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.convex.site/api/agent/lobby/snapshot?limit=80",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer ltcg_test_key" }),
      }),
    );
  });

  it("posts lobby chat and audio control payloads", async () => {
    fetchMock.mockResolvedValueOnce(mockJsonResponse({ ok: true, messageId: "msg_1" }));
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        agentId: "agent_1",
        playbackIntent: "paused",
        musicVolume: 0.4,
        sfxVolume: 0.5,
        musicMuted: false,
        sfxMuted: true,
        updatedAt: Date.now(),
      }),
    );

    const client = new LTCGClient("https://example.convex.site", "ltcg_test_key");
    await client.postLobbyChat("ready", "agent");
    await client.setStreamAudioControl({
      playbackIntent: "paused",
      musicVolume: 0.4,
      sfxMuted: true,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://example.convex.site/api/agent/lobby/chat",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ text: "ready", source: "agent" }),
      }),
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.convex.site/api/agent/stream/audio",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          playbackIntent: "paused",
          musicVolume: 0.4,
          sfxMuted: true,
        }),
      }),
    );
  });
});
