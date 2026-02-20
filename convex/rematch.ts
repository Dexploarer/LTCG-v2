import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./auth";

/**
 * Request a rematch for a completed PvP match.
 * Creates a new pvpLobby with the same settings as the original match.
 */
export const requestRematch = mutation({
  args: { matchId: v.string() },
  returns: v.object({ rematchId: v.string() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Find the lobby for this match
    const lobby = await ctx.db
      .query("pvpLobbies")
      .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
      .first();

    if (!lobby || lobby.status !== "ended") {
      throw new ConvexError("Match must be ended to request rematch.");
    }

    // Prevent duplicate rematch requests — check if one already exists
    const existing = await ctx.db
      .query("pvpLobbies")
      .withIndex("by_hostUserId", (q) => q.eq("hostUserId", String(user._id)))
      .collect();

    const alreadyRequested = existing.some(
      (row) =>
        row.status === "waiting" &&
        typeof row.matchId === "string" &&
        row.matchId.startsWith(`rematch_${args.matchId}_`),
    );
    if (alreadyRequested) {
      const existingRematch = existing.find(
        (row) =>
          row.status === "waiting" &&
          typeof row.matchId === "string" &&
          row.matchId.startsWith(`rematch_${args.matchId}_`),
      );
      return { rematchId: existingRematch!.matchId };
    }

    const now = Date.now();
    const rematchId = `rematch_${args.matchId}_${now}`;

    await ctx.db.insert("pvpLobbies", {
      matchId: rematchId,
      mode: "pvp",
      hostUserId: String(user._id),
      hostUsername:
        typeof (user as any).username === "string" && (user as any).username.trim()
          ? String((user as any).username)
          : "Player",
      visibility: "private",
      status: "waiting",
      createdAt: now,
      pongEnabled: lobby.pongEnabled === true,
      redemptionEnabled: lobby.redemptionEnabled === true,
    });

    return { rematchId };
  },
});

/**
 * Check if a rematch has been requested for a given original match ID.
 * Returns info about the rematch lobby if found.
 */
export const getRematchStatus = query({
  args: { matchId: v.string() },
  returns: v.union(
    v.object({
      hasRematch: v.literal(true),
      rematchMatchId: v.string(),
      requestedBy: v.string(),
    }),
    v.object({
      hasRematch: v.literal(false),
    }),
  ),
  handler: async (ctx, args) => {
    // Find any waiting lobby whose matchId starts with "rematch_{originalMatchId}_"
    const prefix = `rematch_${args.matchId}_`;

    const waitingLobbies = await ctx.db
      .query("pvpLobbies")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .collect();

    const matching = waitingLobbies.find(
      (lobby) => typeof lobby.matchId === "string" && lobby.matchId.startsWith(prefix),
    );

    if (!matching) {
      return { hasRematch: false as const };
    }

    return {
      hasRematch: true as const,
      rematchMatchId: matching.matchId,
      requestedBy: String(matching.hostUserId),
    };
  },
});

/**
 * Accept a rematch by joining the rematch lobby.
 * This reuses the existing joinPvpLobby flow — the caller should navigate
 * to the PvP join flow with the rematch matchId.
 */
export const declineRematch = mutation({
  args: { matchId: v.string() },
  returns: v.object({ declined: v.boolean() }),
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const prefix = `rematch_${args.matchId}_`;
    const waitingLobbies = await ctx.db
      .query("pvpLobbies")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .collect();

    const matching = waitingLobbies.find(
      (lobby) => typeof lobby.matchId === "string" && lobby.matchId.startsWith(prefix),
    );

    if (!matching) {
      return { declined: false };
    }

    // Cancel the rematch lobby
    await ctx.db.patch(matching._id, {
      status: "canceled",
      endedAt: Date.now(),
    });

    return { declined: true };
  },
});
