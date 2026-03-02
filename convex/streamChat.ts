import { v } from "convex/values";
import { LTCGMatch } from "@lunchtable/match";
import { components } from "./_generated/api";
import { internalMutation, query } from "./_generated/server";

const RECENT_LIMIT = 80;
const match: any = new LTCGMatch(components.lunchtable_tcg_match as any);

async function resolveHostAgentIdForMatch(
  ctx: any,
  matchId: string,
) {
  const meta = await match.getMatchMeta(ctx, { matchId });
  const hostId = typeof (meta as any)?.hostId === "string" ? (meta as any).hostId : null;
  if (!hostId) return null;

  const hostAgent = await ctx.db
    .query("agents")
    .withIndex("by_userId", (q: any) => q.eq("userId", hostId as any))
    .first();
  if (!hostAgent || hostAgent.isActive !== true) return null;
  return hostAgent._id;
}

export const postStreamMessage = internalMutation({
  args: {
    agentId: v.id("agents"),
    role: v.union(v.literal("agent"), v.literal("viewer"), v.literal("system")),
    senderName: v.string(),
    text: v.string(),
    source: v.union(
      v.literal("retake"),
      v.literal("telegram"),
      v.literal("discord"),
      v.literal("system"),
      v.literal("other"),
    ),
  },
  returns: v.id("streamMessages"),
  handler: async (ctx, args) => {
    return ctx.db.insert("streamMessages", {
      agentId: args.agentId,
      role: args.role,
      senderName: args.senderName,
      text: args.text,
      source: args.source,
      createdAt: Date.now(),
    });
  },
});

export const getRecentStreamMessages = query({
  args: {
    agentId: v.id("agents"),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("streamMessages"),
    _creationTime: v.number(),
    agentId: v.id("agents"),
    role: v.union(v.literal("agent"), v.literal("viewer"), v.literal("system")),
    senderName: v.string(),
    text: v.string(),
    source: v.union(
      v.literal("retake"),
      v.literal("telegram"),
      v.literal("discord"),
      v.literal("system"),
      v.literal("other"),
    ),
    createdAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, RECENT_LIMIT);
    const messages = await ctx.db
      .query("streamMessages")
      .withIndex("by_agent_created", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(limit);
    // Return oldest-first for display
    return messages.reverse();
  },
});

export const getRecentStreamMessagesByMatch = query({
  args: {
    matchId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("streamMessages"),
    _creationTime: v.number(),
    agentId: v.id("agents"),
    role: v.union(v.literal("agent"), v.literal("viewer"), v.literal("system")),
    senderName: v.string(),
    text: v.string(),
    source: v.union(
      v.literal("retake"),
      v.literal("telegram"),
      v.literal("discord"),
      v.literal("system"),
      v.literal("other"),
    ),
    createdAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, RECENT_LIMIT);
    const agentId = await resolveHostAgentIdForMatch(ctx, args.matchId);
    if (!agentId) return [];

    const messages = await ctx.db
      .query("streamMessages")
      .withIndex("by_agent_created", (q) => q.eq("agentId", agentId))
      .order("desc")
      .take(limit);
    return messages.reverse();
  },
});
