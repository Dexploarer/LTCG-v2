import { beforeEach, describe, expect, it, vi } from "vitest";
import { controlStreamAudioAction } from "../actions/retake/controlStreamAudio.js";

const setStreamAudioControl = vi.fn();

vi.mock("../client.js", () => ({
  getClient: () => ({
    setStreamAudioControl,
  }),
}));

describe("controlStreamAudioAction", () => {
  beforeEach(() => {
    setStreamAudioControl.mockReset();
  });

  it("parses text commands and updates audio control", async () => {
    setStreamAudioControl.mockResolvedValue({
      agentId: "agent_1",
      playbackIntent: "paused",
      musicVolume: 0.65,
      sfxVolume: 0.8,
      musicMuted: false,
      sfxMuted: true,
      updatedAt: Date.now(),
    });

    const callback = vi.fn().mockResolvedValue([]);

    const result = await controlStreamAudioAction.handler(
      { agentId: "agent_1", getSetting: () => undefined } as any,
      { content: { text: "pause music and mute sfx" } } as any,
      undefined,
      undefined,
      callback,
    );

    expect(result?.success).toBe(true);
    expect(setStreamAudioControl).toHaveBeenCalledWith({
      playbackIntent: "paused",
      sfxMuted: true,
    });
    expect(callback).toHaveBeenCalled();
  });

  it("accepts explicit options payload", async () => {
    setStreamAudioControl.mockResolvedValue({
      agentId: "agent_1",
      playbackIntent: "playing",
      musicVolume: 0.4,
      sfxVolume: 0.6,
      musicMuted: false,
      sfxMuted: false,
      updatedAt: Date.now(),
    });

    const result = await controlStreamAudioAction.handler(
      { agentId: "agent_1", getSetting: () => undefined } as any,
      { content: { text: "" } } as any,
      undefined,
      { musicVolume: 40, playbackIntent: "playing" },
      undefined,
    );

    expect(result?.success).toBe(true);
    expect(setStreamAudioControl).toHaveBeenCalledWith({
      playbackIntent: "playing",
      musicVolume: 0.4,
    });
  });

  it("fails when no changes are supplied", async () => {
    const result = await controlStreamAudioAction.handler(
      { agentId: "agent_1", getSetting: () => undefined } as any,
      { content: { text: "hello there" } } as any,
      undefined,
      undefined,
      undefined,
    );

    expect(result?.success).toBe(false);
    expect(setStreamAudioControl).not.toHaveBeenCalled();
  });
});
