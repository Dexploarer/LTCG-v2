/**
 * Action: CONTROL_LTCG_STREAM_AUDIO
 *
 * Updates the authoritative per-agent soundtrack control state used by stream
 * overlays and retake pipeline output.
 */

import { getClient } from "../../client.js";
import type {
  Action,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
  StreamAudioControl,
} from "../../types.js";

function parseVolume(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1 ? Math.max(0, Math.min(1, value / 100)) : Math.max(0, Math.min(1, value));
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (!Number.isFinite(parsed)) return null;
    return parsed > 1
      ? Math.max(0, Math.min(1, parsed / 100))
      : Math.max(0, Math.min(1, parsed));
  }
  return null;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on", "mute", "muted"].includes(normalized)) return true;
    if (["false", "0", "no", "off", "unmute", "unmuted"].includes(normalized)) return false;
  }
  return null;
}

function parsePatchFromText(text: string): Partial<
  Pick<
    StreamAudioControl,
    "playbackIntent" | "musicVolume" | "sfxVolume" | "musicMuted" | "sfxMuted"
  >
> {
  const lowered = text.toLowerCase();
  const patch: Partial<
    Pick<
      StreamAudioControl,
      "playbackIntent" | "musicVolume" | "sfxVolume" | "musicMuted" | "sfxMuted"
    >
  > = {};

  if (/\b(pause|paused)\b/.test(lowered)) {
    patch.playbackIntent = "paused";
  } else if (/\b(stop|stopped)\b/.test(lowered)) {
    patch.playbackIntent = "stopped";
  } else if (/\b(play|resume|unpause|start)\b/.test(lowered)) {
    patch.playbackIntent = "playing";
  }

  const musicVolumeMatch = lowered.match(/music(?:\s+volume)?\s*(?:to|=)?\s*(\d{1,3}(?:\.\d+)?)/i);
  if (musicVolumeMatch?.[1]) {
    const parsed = parseVolume(musicVolumeMatch[1]);
    if (parsed !== null) patch.musicVolume = parsed;
  }

  const sfxVolumeMatch = lowered.match(/sfx(?:\s+volume)?\s*(?:to|=)?\s*(\d{1,3}(?:\.\d+)?)/i);
  if (sfxVolumeMatch?.[1]) {
    const parsed = parseVolume(sfxVolumeMatch[1]);
    if (parsed !== null) patch.sfxVolume = parsed;
  }

  if (/\bmute all\b/.test(lowered)) {
    patch.musicMuted = true;
    patch.sfxMuted = true;
  } else if (/\bunmute all\b/.test(lowered)) {
    patch.musicMuted = false;
    patch.sfxMuted = false;
  } else {
    if (/\bmute music\b/.test(lowered)) patch.musicMuted = true;
    if (/\bunmute music\b/.test(lowered)) patch.musicMuted = false;
    if (/\bmute sfx\b/.test(lowered)) patch.sfxMuted = true;
    if (/\bunmute sfx\b/.test(lowered)) patch.sfxMuted = false;
  }

  return patch;
}

function describePatch(
  patch: Partial<
    Pick<
      StreamAudioControl,
      "playbackIntent" | "musicVolume" | "sfxVolume" | "musicMuted" | "sfxMuted"
    >
  >,
): string {
  const lines: string[] = [];
  if (patch.playbackIntent) lines.push(`intent=${patch.playbackIntent}`);
  if (typeof patch.musicVolume === "number") lines.push(`musicVolume=${Math.round(patch.musicVolume * 100)}%`);
  if (typeof patch.sfxVolume === "number") lines.push(`sfxVolume=${Math.round(patch.sfxVolume * 100)}%`);
  if (typeof patch.musicMuted === "boolean") lines.push(`musicMuted=${patch.musicMuted}`);
  if (typeof patch.sfxMuted === "boolean") lines.push(`sfxMuted=${patch.sfxMuted}`);
  return lines.join(", ");
}

export const controlStreamAudioAction: Action = {
  name: "CONTROL_LTCG_STREAM_AUDIO",
  similes: [
    "SET_LTCG_AUDIO",
    "SET_STREAM_AUDIO",
    "CONTROL_STREAM_SOUNDTRACK",
    "LTCG_AUDIO_CONTROL",
  ],
  description:
    "Control authoritative stream soundtrack state (play/pause/stop, music+sfx volume, mute toggles) for LunchTable overlays and retake output.",

  validate: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
  ) => {
    try {
      getClient();
      return true;
    } catch {
      return false;
    }
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const client = getClient();

    const patch = parsePatchFromText(message.content?.text ?? "");

    if (options) {
      if (options.playbackIntent === "playing" || options.playbackIntent === "paused" || options.playbackIntent === "stopped") {
        patch.playbackIntent = options.playbackIntent;
      }

      const musicVolume = parseVolume(options.musicVolume);
      if (musicVolume !== null) patch.musicVolume = musicVolume;

      const sfxVolume = parseVolume(options.sfxVolume);
      if (sfxVolume !== null) patch.sfxVolume = sfxVolume;

      const musicMuted = parseBoolean(options.musicMuted);
      if (musicMuted !== null) patch.musicMuted = musicMuted;

      const sfxMuted = parseBoolean(options.sfxMuted);
      if (sfxMuted !== null) patch.sfxMuted = sfxMuted;
    }

    if (Object.keys(patch).length === 0) {
      const text =
        "No audio control changes detected. Specify intent, volume, or mute fields (e.g. 'pause music', 'music volume 40', 'mute sfx').";
      if (callback) await callback({ text, action: "CONTROL_LTCG_STREAM_AUDIO" });
      return { success: false, error: text };
    }

    try {
      const result = await client.setStreamAudioControl(patch);
      const text = `Updated stream audio control: ${describePatch(patch)}.`;
      if (callback) await callback({ text, action: "CONTROL_LTCG_STREAM_AUDIO" });
      return { success: true, data: result };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      if (callback) {
        await callback({
          text: `Failed to update stream audio control: ${messageText}`,
          action: "CONTROL_LTCG_STREAM_AUDIO",
        });
      }
      return { success: false, error: messageText };
    }
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "Pause music and set sfx volume to 30" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Updating authoritative stream audio: pause + lower sfx.",
          action: "CONTROL_LTCG_STREAM_AUDIO",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "Resume soundtrack and unmute all" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Resuming stream soundtrack and clearing mutes.",
          action: "CONTROL_LTCG_STREAM_AUDIO",
        },
      },
    ],
  ],
};
