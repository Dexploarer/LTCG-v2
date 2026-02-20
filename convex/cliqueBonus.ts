import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser } from "./auth";

// ── Constants ──────────────────────────────────────────────────

const CLIQUE_ARCHETYPE_XP_BONUS = 0.1; // +10% XP

// ── Helpers ────────────────────────────────────────────────────

/**
 * Calculate clique XP bonus.
 * Returns +10% when the user's clique archetype matches the deck archetype.
 */
export function calculateCliqueXpBonus(
  baseXp: number,
  cliqueArchetype: string | undefined,
  deckArchetype: string | undefined,
): number {
  if (!cliqueArchetype || !deckArchetype) return 0;
  if (cliqueArchetype !== deckArchetype) return 0;
  return Math.round(baseXp * CLIQUE_ARCHETYPE_XP_BONUS);
}

// ── Queries ────────────────────────────────────────────────────

/**
 * Get the current user's clique info + bonus multiplier.
 */
export const getCliqueBonus = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    if (!user.cliqueId) {
      return {
        hasClique: false,
        clique: null,
        bonusMultiplier: 1.0,
      };
    }

    const clique = await ctx.db.get(user.cliqueId);
    if (!clique) {
      return {
        hasClique: false,
        clique: null,
        bonusMultiplier: 1.0,
      };
    }

    return {
      hasClique: true,
      clique: {
        _id: clique._id,
        name: clique.name,
        archetype: clique.archetype,
        description: clique.description,
        memberCount: clique.memberCount,
        totalWins: clique.totalWins,
      },
      bonusMultiplier: 1.0 + CLIQUE_ARCHETYPE_XP_BONUS,
      bonusDescription: `+${CLIQUE_ARCHETYPE_XP_BONUS * 100}% XP when playing with ${clique.archetype} deck`,
    };
  },
});

/**
 * Get the clique leaderboard (top cliques by totalWins).
 */
export const getCliqueLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    // Fetch all cliques and sort by totalWins descending
    const cliques = await ctx.db.query("cliques").collect();
    cliques.sort((a, b) => b.totalWins - a.totalWins);

    return cliques.slice(0, limit).map((c) => ({
      _id: c._id,
      name: c.name,
      archetype: c.archetype,
      memberCount: c.memberCount,
      totalWins: c.totalWins,
    }));
  },
});

/**
 * Get members of a specific clique.
 */
export const getCliqueMembers = query({
  args: { cliqueId: v.id("cliques") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("users")
      .withIndex("by_clique", (q) => q.eq("cliqueId", args.cliqueId))
      .collect();

    return members.map((m) => ({
      _id: m._id,
      username: m.username,
      cliqueRole: m.cliqueRole,
      avatarPath: m.avatarPath,
    }));
  },
});
