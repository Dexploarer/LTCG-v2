import { v } from "convex/values";
import { LTCGMatch } from "@lunchtable/match";
import { components } from "./_generated/api";
import { internalMutation, query } from "./_generated/server";

const match: any = new LTCGMatch(components.lunchtable_tcg_match as any);

const DEFAULT_STREAM_AUDIO_CONTROL = {
  playbackIntent: "playing" as const,
  musicVolume: 0.65,
  sfxVolume: 0.8,
  musicMuted: false,
  sfxMuted: false,
  updatedAt: 0,
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function normalizeIntent(value: unknown): "playing" | "paused" | "stopped" {
  return value === "paused" || value === "stopped" ? value : "playing";
}

function normalizeVolume(value: unknown, fallback: number): number {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numeric)) return fallback;
  const normalized = numeric > 1 ? numeric / 100 : numeric;
  return clamp01(normalized);
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(lowered)) return true;
    if (["false", "0", "no", "off"].includes(lowered)) return false;
  }
  return fallback;
}

const vPlaybackIntent = v.union(
  v.literal("playing"),
  v.literal("paused"),
  v.literal("stopped"),
);

const vStreamAudioControl = v.object({
  agentId: v.id("agents"),
  playbackIntent: vPlaybackIntent,
  musicVolume: v.number(),
  sfxVolume: v.number(),
  musicMuted: v.boolean(),
  sfxMuted: v.boolean(),
  updatedAt: v.number(),
});

function toControlForAgent(args: {
  agentId: any;
  existing:
    | {
        playbackIntent: "playing" | "paused" | "stopped";
        musicVolume: number;
        sfxVolume: number;
        musicMuted: boolean;
        sfxMuted: boolean;
        updatedAt: number;
      }
    | null;
  patch: {
    playbackIntent?: unknown;
    musicVolume?: unknown;
    sfxVolume?: unknown;
    musicMuted?: unknown;
    sfxMuted?: unknown;
  };
  updatedAt: number;
}) {
  const source = args.existing ?? DEFAULT_STREAM_AUDIO_CONTROL;
  return {
    agentId: args.agentId,
    playbackIntent: normalizeIntent(args.patch.playbackIntent ?? source.playbackIntent),
    musicVolume: normalizeVolume(args.patch.musicVolume, source.musicVolume),
    sfxVolume: normalizeVolume(args.patch.sfxVolume, source.sfxVolume),
    musicMuted: normalizeBoolean(args.patch.musicMuted, source.musicMuted),
    sfxMuted: normalizeBoolean(args.patch.sfxMuted, source.sfxMuted),
    updatedAt: args.updatedAt,
  };
}

export const getByAgentId = query({
  args: {
    agentId: v.id("agents"),
  },
  returns: vStreamAudioControl,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("streamAudioControls")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .first();

    if (!existing) {
      return {
        agentId: args.agentId,
        ...DEFAULT_STREAM_AUDIO_CONTROL,
      };
    }

    return {
      agentId: args.agentId,
      playbackIntent: normalizeIntent(existing.playbackIntent),
      musicVolume: normalizeVolume(existing.musicVolume, DEFAULT_STREAM_AUDIO_CONTROL.musicVolume),
      sfxVolume: normalizeVolume(existing.sfxVolume, DEFAULT_STREAM_AUDIO_CONTROL.sfxVolume),
      musicMuted: normalizeBoolean(existing.musicMuted, DEFAULT_STREAM_AUDIO_CONTROL.musicMuted),
      sfxMuted: normalizeBoolean(existing.sfxMuted, DEFAULT_STREAM_AUDIO_CONTROL.sfxMuted),
      updatedAt: typeof existing.updatedAt === "number" ? existing.updatedAt : 0,
    };
  },
});

export const getByMatchId = query({
  args: {
    matchId: v.string(),
  },
  returns: v.union(vStreamAudioControl, v.null()),
  handler: async (ctx, args) => {
    const meta = await match.getMatchMeta(ctx, { matchId: args.matchId });
    const hostId = typeof (meta as any)?.hostId === "string" ? (meta as any).hostId : null;
    if (!hostId) return null;

    const hostAgent = await ctx.db
      .query("agents")
      .withIndex("by_userId", (q) => q.eq("userId", hostId as any))
      .first();
    if (!hostAgent || hostAgent.isActive !== true) return null;

    const existing = await ctx.db
      .query("streamAudioControls")
      .withIndex("by_agentId", (q) => q.eq("agentId", hostAgent._id))
      .first();

    if (!existing) {
      return {
        agentId: hostAgent._id,
        ...DEFAULT_STREAM_AUDIO_CONTROL,
      };
    }

    return {
      agentId: hostAgent._id,
      playbackIntent: normalizeIntent(existing.playbackIntent),
      musicVolume: normalizeVolume(existing.musicVolume, DEFAULT_STREAM_AUDIO_CONTROL.musicVolume),
      sfxVolume: normalizeVolume(existing.sfxVolume, DEFAULT_STREAM_AUDIO_CONTROL.sfxVolume),
      musicMuted: normalizeBoolean(existing.musicMuted, DEFAULT_STREAM_AUDIO_CONTROL.musicMuted),
      sfxMuted: normalizeBoolean(existing.sfxMuted, DEFAULT_STREAM_AUDIO_CONTROL.sfxMuted),
      updatedAt: typeof existing.updatedAt === "number" ? existing.updatedAt : 0,
    };
  },
});

export const upsertForAgent = internalMutation({
  args: {
    agentId: v.id("agents"),
    playbackIntent: v.optional(vPlaybackIntent),
    musicVolume: v.optional(v.number()),
    sfxVolume: v.optional(v.number()),
    musicMuted: v.optional(v.boolean()),
    sfxMuted: v.optional(v.boolean()),
  },
  returns: vStreamAudioControl,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("streamAudioControls")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .first();

    const next = toControlForAgent({
      agentId: args.agentId,
      existing:
        existing === null
          ? null
          : {
              playbackIntent: normalizeIntent(existing.playbackIntent),
              musicVolume: normalizeVolume(
                existing.musicVolume,
                DEFAULT_STREAM_AUDIO_CONTROL.musicVolume,
              ),
              sfxVolume: normalizeVolume(
                existing.sfxVolume,
                DEFAULT_STREAM_AUDIO_CONTROL.sfxVolume,
              ),
              musicMuted: normalizeBoolean(
                existing.musicMuted,
                DEFAULT_STREAM_AUDIO_CONTROL.musicMuted,
              ),
              sfxMuted: normalizeBoolean(
                existing.sfxMuted,
                DEFAULT_STREAM_AUDIO_CONTROL.sfxMuted,
              ),
              updatedAt: typeof existing.updatedAt === "number" ? existing.updatedAt : 0,
            },
      patch: args,
      updatedAt: Date.now(),
    });

    if (existing) {
      await ctx.db.patch(existing._id, {
        playbackIntent: next.playbackIntent,
        musicVolume: next.musicVolume,
        sfxVolume: next.sfxVolume,
        musicMuted: next.musicMuted,
        sfxMuted: next.sfxMuted,
        updatedAt: next.updatedAt,
      });
      return next;
    }

    await ctx.db.insert("streamAudioControls", {
      agentId: args.agentId,
      playbackIntent: next.playbackIntent,
      musicVolume: next.musicVolume,
      sfxVolume: next.sfxVolume,
      musicMuted: next.musicMuted,
      sfxMuted: next.sfxMuted,
      updatedAt: next.updatedAt,
    });
    return next;
  },
});
