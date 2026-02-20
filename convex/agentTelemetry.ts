// Agent telemetry and stats tracking
import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";

// ── Queries ──────────────────────────────────────────────────

/**
 * Get stats for a specific agent.
 */
export const getAgentStats = query({
  args: { agentId: v.id("agents") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query("agentStats")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .unique();

    if (!stats) {
      // Return default zeroed stats
      return {
        agentId: args.agentId,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        avgTurnsPerMatch: 0,
        totalTurns: 0,
        favoriteArchetype: null,
        agentVsHumanWins: 0,
        agentVsHumanLosses: 0,
        agentVsAgentWins: 0,
        agentVsAgentLosses: 0,
        lastMatchAt: null,
      };
    }

    return stats;
  },
});

/**
 * Leaderboard: top agents by wins.
 */
export const getAgentLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const topAgents = await ctx.db
      .query("agentStats")
      .withIndex("by_wins")
      .order("desc")
      .take(limit);

    // Enrich with agent names
    const enriched = [];
    for (const stats of topAgents) {
      const agent = await ctx.db.get(stats.agentId);
      enriched.push({
        agentId: stats.agentId,
        agentName: agent?.name ?? "Unknown",
        isActive: agent?.isActive ?? false,
        matchesPlayed: stats.matchesPlayed,
        wins: stats.wins,
        losses: stats.losses,
        winRate:
          stats.matchesPlayed > 0
            ? Math.round((stats.wins / stats.matchesPlayed) * 100)
            : 0,
        avgTurnsPerMatch: stats.avgTurnsPerMatch,
        favoriteArchetype: stats.favoriteArchetype,
        agentVsHumanWins: stats.agentVsHumanWins,
        agentVsAgentWins: stats.agentVsAgentWins,
        lastMatchAt: stats.lastMatchAt,
      });
    }

    return enriched;
  },
});

// ── Internal Mutations ──────────────────────────────────────

/**
 * Record match result for an agent player.
 * Called after match completion when one or both players are agents.
 */
export const recordAgentMatch = internalMutation({
  args: {
    agentId: v.id("agents"),
    won: v.boolean(),
    turns: v.number(),
    archetype: v.optional(v.string()),
    opponentIsAgent: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("agentStats")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .unique();

    if (!existing) {
      // Create new stats row
      await ctx.db.insert("agentStats", {
        agentId: args.agentId,
        matchesPlayed: 1,
        wins: args.won ? 1 : 0,
        losses: args.won ? 0 : 1,
        avgTurnsPerMatch: args.turns,
        totalTurns: args.turns,
        favoriteArchetype: args.archetype,
        agentVsHumanWins: !args.opponentIsAgent && args.won ? 1 : 0,
        agentVsHumanLosses: !args.opponentIsAgent && !args.won ? 1 : 0,
        agentVsAgentWins: args.opponentIsAgent && args.won ? 1 : 0,
        agentVsAgentLosses: args.opponentIsAgent && !args.won ? 1 : 0,
        lastMatchAt: now,
        createdAt: now,
        updatedAt: now,
      });
      return null;
    }

    // Update existing stats
    const newMatchesPlayed = existing.matchesPlayed + 1;
    const newTotalTurns = existing.totalTurns + args.turns;
    const newAvgTurns = Math.round(newTotalTurns / newMatchesPlayed);

    await ctx.db.patch(existing._id, {
      matchesPlayed: newMatchesPlayed,
      wins: existing.wins + (args.won ? 1 : 0),
      losses: existing.losses + (args.won ? 0 : 1),
      avgTurnsPerMatch: newAvgTurns,
      totalTurns: newTotalTurns,
      favoriteArchetype: args.archetype ?? existing.favoriteArchetype,
      agentVsHumanWins:
        existing.agentVsHumanWins +
        (!args.opponentIsAgent && args.won ? 1 : 0),
      agentVsHumanLosses:
        existing.agentVsHumanLosses +
        (!args.opponentIsAgent && !args.won ? 1 : 0),
      agentVsAgentWins:
        existing.agentVsAgentWins +
        (args.opponentIsAgent && args.won ? 1 : 0),
      agentVsAgentLosses:
        existing.agentVsAgentLosses +
        (args.opponentIsAgent && !args.won ? 1 : 0),
      lastMatchAt: now,
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Record an individual agent decision (lightweight logging).
 * Useful for analyzing agent behavior patterns.
 */
export const recordAgentDecision = internalMutation({
  args: {
    agentId: v.id("agents"),
    matchId: v.string(),
    turn: v.number(),
    commandType: v.string(),
    thinkTimeMs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Lightweight: just update lastMatchAt to confirm activity.
    // Full decision logging can be added to a dedicated table later
    // if granular replay analysis is needed.
    const stats = await ctx.db
      .query("agentStats")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .unique();

    if (stats) {
      await ctx.db.patch(stats._id, { updatedAt: Date.now() });
    }

    return null;
  },
});
