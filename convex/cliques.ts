import { v } from "convex/values";
import { components } from "./_generated/api";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireUser } from "./auth";
import { LTCGCards } from "@lunchtable-tcg/cards";

const cards = new LTCGCards(components.lunchtable_tcg_cards as any);

const RESERVED_DECK_IDS = new Set(["undefined", "null", "skip"]);
const ARCHETYPE_ALIASES: Record<string, string> = {
  dropout: "dropouts",
  dropouts: "dropouts",
  prep: "preps",
  preps: "preps",
  geek: "geeks",
  geeks: "geeks",
  freak: "freaks",
  freaks: "freaks",
  nerd: "nerds",
  nerds: "nerds",
  goodie: "goodies",
  goodies: "goodies",
  goodie_two_shoes: "goodies",
  goodietwoshoes: "goodies",
};

const CLIQUE_DATA = [
  { name: "Dropout Gang", archetype: "dropouts", description: "High-risk, high-reward chaos. Live fast, break things." },
  { name: "Honor Club", archetype: "preps", description: "Status and social warfare. Always be closing." },
  { name: "Geek Squad", archetype: "geeks", description: "Card draw and tech control. Outsmart the opposition." },
  { name: "Freak Show", archetype: "freaks", description: "Disruption and chaos. Make things weird." },
  { name: "Nerd Herd", archetype: "nerds", description: "Defensive control. The best defense is a good offense." },
  { name: "Goodie Two-Shoes", archetype: "goodies", description: "Attrition and grind. Never give an inch." },
];

const normalizeDeckId = (deckId: string | undefined): string | null => {
  if (!deckId) return null;
  const trimmed = deckId.trim();
  if (!trimmed) return null;
  if (RESERVED_DECK_IDS.has(trimmed.toLowerCase())) return null;
  return trimmed;
};

const normalizeArchetype = (value: string | undefined): string | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (!normalized) return null;
  return ARCHETYPE_ALIASES[normalized] ?? null;
};

const resolveDeckArchetype = (deck: any): string | null => {
  const direct = normalizeArchetype(
    typeof deck?.deckArchetype === "string" ? deck.deckArchetype : undefined,
  );
  if (direct) return direct;

  const byDeckCode =
    typeof deck?.deckCode === "string" && deck.deckCode.endsWith("_starter")
      ? normalizeArchetype(deck.deckCode.replace("_starter", ""))
      : null;
  if (byDeckCode) return byDeckCode;

  const byName =
    typeof deck?.name === "string" && deck.name.endsWith("_starter")
      ? normalizeArchetype(deck.name.replace("_starter", ""))
      : null;
  return byName;
};

const sortCliques = <T extends { memberCount: number; totalWins: number; name: string }>(
  cliques: T[],
) =>
  cliques.sort((a, b) => {
    if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
    if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
    return a.name.localeCompare(b.name);
  });

async function resolveUserStarterArchetype(
  ctx: any,
  user: { _id: string; activeDeckId?: string },
) {
  const decks = await cards.decks.getUserDecks(ctx, user._id);
  if (!decks?.length) return null;

  const normalizedActiveDeckId = normalizeDeckId(user.activeDeckId);
  const activeDeck = normalizedActiveDeckId
    ? decks.find((deck: any) => normalizeDeckId(deck?.deckId) === normalizedActiveDeckId)
    : null;

  if (activeDeck) {
    const activeDeckArchetype = resolveDeckArchetype(activeDeck);
    if (activeDeckArchetype) return activeDeckArchetype;
  }

  for (const deck of decks) {
    const deckArchetype = resolveDeckArchetype(deck);
    if (deckArchetype) return deckArchetype;
  }

  return null;
}

async function assignUserToCliqueByArchetype(
  ctx: any,
  userId: any,
  rawArchetype: string,
) {
  const archetype = normalizeArchetype(rawArchetype);
  if (!archetype) return null;

  const clique = await ctx.db
    .query("cliques")
    .withIndex("by_archetype", (q: any) => q.eq("archetype", archetype))
    .first();
  if (!clique) return null;

  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");

  if (user.cliqueId) {
    const existingClique = await ctx.db.get(user.cliqueId);
    if (existingClique?._id === clique._id) {
      if (user.cliqueRole !== "member") {
        await ctx.db.patch(user._id, { cliqueRole: "member" });
      }
      return clique;
    }

    if (existingClique) {
      await ctx.db.patch(existingClique._id, {
        memberCount: Math.max(0, existingClique.memberCount - 1),
      });
    }
  }

  await ctx.db.patch(user._id, {
    cliqueId: clique._id,
    cliqueRole: "member",
  });

  await ctx.db.patch(clique._id, {
    memberCount: clique.memberCount + 1,
  });

  return clique;
}

export const getAllCliques = query({
  args: {},
  handler: async (ctx) => {
    const cliques = await ctx.db.query("cliques").collect();
    return sortCliques(cliques);
  },
});

export const getCliqueByArchetype = query({
  args: { archetype: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cliques")
      .withIndex("by_archetype", (q) => q.eq("archetype", args.archetype))
      .first();
  },
});

export const getMyClique = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user.cliqueId) return null;
    return await ctx.db.get(user.cliqueId);
  },
});

export const getCliqueDashboard = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const cliques = sortCliques(await ctx.db.query("cliques").collect());

    const myClique = user.cliqueId ? await ctx.db.get(user.cliqueId) : null;
    const myArchetype = await resolveUserStarterArchetype(ctx, user);

    const members = user.cliqueId
      ? await ctx.db
          .query("users")
          .withIndex("by_clique", (q) => q.eq("cliqueId", user.cliqueId))
          .collect()
      : [];

    members.sort((a, b) =>
      (a.username ?? a.name ?? "").localeCompare(b.username ?? b.name ?? ""),
    );

    const rosterPreview = members.slice(0, 12).map((member) => ({
      _id: member._id,
      username: member.username,
      name: member.name,
      cliqueRole: member.cliqueRole,
      createdAt: member.createdAt,
    }));

    return {
      myArchetype,
      myClique,
      myCliqueMembers: rosterPreview,
      myCliqueMemberOverflow: Math.max(0, members.length - rosterPreview.length),
      totalPlayers: cliques.reduce((sum, clique) => sum + clique.memberCount, 0),
      leaderboard: cliques.map((clique, index) => ({
        ...clique,
        rank: index + 1,
        isMyClique: Boolean(myClique && clique._id === myClique._id),
      })),
    };
  },
});

export const getCliqueMembers = query({
  args: { cliqueId: v.id("cliques") },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("users")
      .withIndex("by_clique", (q) => q.eq("cliqueId", args.cliqueId))
      .collect();
    return members.map((m) => ({
      _id: m._id,
      username: m.username,
      name: m.name,
      cliqueRole: m.cliqueRole,
      createdAt: m.createdAt,
    }));
  },
});

export const joinClique = mutation({
  args: { cliqueId: v.id("cliques") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const clique = await ctx.db.get(args.cliqueId);
    if (!clique) {
      throw new Error("Clique not found");
    }

    const userArchetype = await resolveUserStarterArchetype(ctx, user);
    if (userArchetype && clique.archetype !== userArchetype) {
      throw new Error(
        `Starter deck locked to ${userArchetype}. You can only join that clique.`,
      );
    }

    return assignUserToCliqueByArchetype(ctx, user._id, clique.archetype);
  },
});

export const leaveClique = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    
    if (!user.cliqueId) {
      throw new Error("Not in a clique");
    }
    
    const clique = await ctx.db.get(user.cliqueId);
    if (!clique) {
      throw new Error("Clique not found");
    }
    
    // Leaders/founders can't leave if they're the only one
    if (user.cliqueRole === "founder" || user.cliqueRole === "leader") {
      if (clique.memberCount <= 1) {
        // Delete the clique entirely
        await ctx.db.delete(user.cliqueId);
      } else {
        throw new Error("Transfer leadership before leaving");
      }
    }
    
    // Update user
    await ctx.db.patch(user._id, {
      cliqueId: undefined,
      cliqueRole: undefined,
    });
    
    // Update member count
    await ctx.db.patch(user.cliqueId, {
      memberCount: Math.max(0, clique.memberCount - 1),
    });
  },
});

export const seedCliques = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existing = await ctx.db.query("cliques").first();
    if (existing) return;
    
    for (const data of CLIQUE_DATA) {
      await ctx.db.insert("cliques", {
        ...data,
        iconUrl: undefined,
        memberCount: 0,
        totalWins: 0,
        createdAt: Date.now(),
      });
    }
  },
});

export const autoAssignUserToCliqueFromArchetype = internalMutation({
  args: {
    userId: v.id("users"),
    archetype: v.string(),
  },
  handler: async (ctx, args) => {
    const clique = await assignUserToCliqueByArchetype(
      ctx,
      args.userId,
      args.archetype,
    );

    return clique?._id ?? null;
  },
});

export const ensureMyCliqueAssignment = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    if (user.cliqueId) {
      const myClique = await ctx.db.get(user.cliqueId);
      if (myClique) {
        return { status: "already_assigned", clique: myClique };
      }

      await ctx.db.patch(user._id, {
        cliqueId: undefined,
        cliqueRole: undefined,
      });
    }

    const archetype = await resolveUserStarterArchetype(ctx, user);
    if (!archetype) {
      return { status: "missing_starter_deck" };
    }

    const clique = await assignUserToCliqueByArchetype(ctx, user._id, archetype);
    if (!clique) {
      return { status: "missing_clique", archetype };
    }

    return { status: "assigned", clique };
  },
});
