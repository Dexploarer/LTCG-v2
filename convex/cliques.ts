import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireUser } from "./auth";

const CLIQUE_DATA = [
  { name: "Dropout Gang", archetype: "dropouts", description: "High-risk, high-reward chaos. Live fast, break things." },
  { name: "Honor Club", archetype: "preps", description: "Status and social warfare. Always be closing." },
  { name: "Geek Squad", archetype: "geeks", description: "Card draw and tech control. Outsmart the opposition." },
  { name: "Freak Show", archetype: "freaks", description: "Disruption and chaos. Make things weird." },
  { name: "Nerd Herd", archetype: "nerds", description: "Defensive control. The best defense is a good offense." },
  { name: "Goodie Two-Shoes", archetype: "goodies", description: "Attrition and grind. Never give an inch." },
];

export const getAllCliques = query({
  args: {},
  handler: async (ctx) => {
    const cliques = await ctx.db.query("cliques").collect();
    return cliques.sort((a, b) => b.memberCount - a.memberCount);
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
    
    // Already in a clique?
    if (user.cliqueId) {
      throw new Error("Already in a clique. Leave your current clique first.");
    }
    
    const clique = await ctx.db.get(args.cliqueId);
    if (!clique) {
      throw new Error("Clique not found");
    }
    
    // Update user
    await ctx.db.patch(user._id, {
      cliqueId: args.cliqueId,
      cliqueRole: "member",
    });
    
    // Update member count
    await ctx.db.patch(args.cliqueId, {
      memberCount: clique.memberCount + 1,
    });
    
    return clique;
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
