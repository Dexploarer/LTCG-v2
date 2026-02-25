import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { components } from "./_generated/api";
import { LTCGMatch } from "@lunchtable/match";
import { requireUser } from "./auth";

const DEFAULT_MESSAGE_LIMIT = 80;
const MAX_MESSAGE_LIMIT = 150;
const MAX_MESSAGE_LENGTH = 280;
const match: any = new LTCGMatch(components.lunchtable_tcg_match as any);

const vLobbyStatus = v.union(v.literal("waiting"), v.literal("active"));
const vLobbyMessage = v.object({
  _id: v.id("agentLobbyMessages"),
  _creationTime: v.number(),
  userId: v.id("users"),
  senderName: v.string(),
  text: v.string(),
  source: v.union(v.literal("agent"), v.literal("retake"), v.literal("system")),
  createdAt: v.number(),
});

const vLobbySummary = v.object({
  matchId: v.string(),
  hostUserId: v.string(),
  hostUsername: v.string(),
  visibility: v.union(v.literal("public"), v.literal("private")),
  joinCode: v.union(v.string(), v.null()),
  status: vLobbyStatus,
  createdAt: v.number(),
  activatedAt: v.union(v.number(), v.null()),
  pongEnabled: v.boolean(),
  redemptionEnabled: v.boolean(),
  retake: v.object({
    hasRetakeAccount: v.boolean(),
    pipelineEnabled: v.boolean(),
    agentName: v.union(v.string(), v.null()),
    tokenAddress: v.union(v.string(), v.null()),
    tokenTicker: v.union(v.string(), v.null()),
    streamUrl: v.union(v.string(), v.null()),
  }),
});

const vStorySummary = v.object({
  matchId: v.string(),
  chapterId: v.string(),
  stageNumber: v.number(),
  playerUserId: v.string(),
  playerUsername: v.string(),
  status: vLobbyStatus,
  retake: v.object({
    hasRetakeAccount: v.boolean(),
    pipelineEnabled: v.boolean(),
    agentName: v.union(v.string(), v.null()),
    tokenAddress: v.union(v.string(), v.null()),
    tokenTicker: v.union(v.string(), v.null()),
    streamUrl: v.union(v.string(), v.null()),
  }),
});

function getRetakeSummary(user: any) {
  const agentName =
    typeof user?.retakeAgentName === "string" && user.retakeAgentName.trim()
      ? user.retakeAgentName.trim()
      : null;
  return {
    hasRetakeAccount: Boolean(user?.retakeAgentId && user?.retakeUserDbId && user?.retakeTokenAddress),
    pipelineEnabled: user?.retakePipelineEnabled === true,
    agentName,
    tokenAddress: user?.retakeTokenAddress ?? null,
    tokenTicker: user?.retakeTokenTicker ?? null,
    streamUrl: agentName ? `https://retake.tv/${encodeURIComponent(agentName)}` : null,
  } as const;
}

export const getLobbySnapshot = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.object({
    currentUser: v.object({
      userId: v.string(),
      username: v.string(),
      walletAddress: v.union(v.string(), v.null()),
      hasRetakeAccount: v.boolean(),
      pipelineEnabled: v.boolean(),
      agentName: v.union(v.string(), v.null()),
      tokenAddress: v.union(v.string(), v.null()),
      tokenTicker: v.union(v.string(), v.null()),
      streamUrl: v.union(v.string(), v.null()),
    }),
    openLobbies: v.array(vLobbySummary),
    activeStoryMatches: v.array(vStorySummary),
    messages: v.array(vLobbyMessage),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = Math.min(
      Math.max(Math.floor(args.limit ?? DEFAULT_MESSAGE_LIMIT), 1),
      MAX_MESSAGE_LIMIT,
    );

    const waitingRows = await ctx.db
      .query("pvpLobbies")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .collect();
    const activeRows = await ctx.db
      .query("pvpLobbies")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const rows = [...waitingRows, ...activeRows]
      .filter((row) => row.status === "waiting" || row.status === "active")
      .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));

    const hostIds = Array.from(new Set(rows.map((row) => String(row.hostUserId))));
    const usersById = new Map<string, any>();
    for (const hostId of hostIds) {
      const hostUser = await ctx.db.get(hostId as any);
      if (hostUser) usersById.set(hostId, hostUser);
    }

    const openLobbies = rows
      .filter((row) => row.visibility === "public" || String(row.hostUserId) === String(user._id))
      .map((row) => {
        const hostUser = usersById.get(String(row.hostUserId));
        const hostUsername =
          (typeof hostUser?.username === "string" && hostUser.username.trim()) ||
          (typeof row.hostUsername === "string" && row.hostUsername.trim()) ||
          "Agent";

        const isHost = String(row.hostUserId) === String(user._id);
        const joinCode = row.visibility === "private" && !isHost ? null : row.joinCode ?? null;

        return {
          matchId: String(row.matchId),
          hostUserId: String(row.hostUserId),
          hostUsername,
          visibility: row.visibility === "private" ? "private" : "public",
          joinCode,
          status: row.status === "active" ? "active" : "waiting",
          createdAt: Number(row.createdAt ?? Date.now()),
          activatedAt:
            typeof row.activatedAt === "number" && Number.isFinite(row.activatedAt)
              ? row.activatedAt
              : null,
          pongEnabled: row.pongEnabled === true,
          redemptionEnabled: row.redemptionEnabled === true,
          retake: getRetakeSummary(hostUser),
        };
      });

    const storyRows = await ctx.db.query("storyMatches").collect();
    const activeStoryMatches: Array<{
      matchId: string;
      chapterId: string;
      stageNumber: number;
      playerUserId: string;
      playerUsername: string;
      status: "waiting" | "active";
      retake: ReturnType<typeof getRetakeSummary>;
    }> = [];
    for (const row of storyRows) {
      if (row.outcome) continue;

      const matchMeta = await match.getMatchMeta(ctx, { matchId: row.matchId });
      const metaStatus = matchMeta?.status;
      if (metaStatus !== "waiting" && metaStatus !== "active") continue;

      const playerUser = usersById.get(String(row.userId)) ?? (await ctx.db.get(String(row.userId) as any));
      if (playerUser) usersById.set(String(row.userId), playerUser);
      const playerUsername =
        (typeof playerUser?.username === "string" && playerUser.username.trim()) || "Agent";

      activeStoryMatches.push({
        matchId: String(row.matchId),
        chapterId: String(row.chapterId),
        stageNumber: Number(row.stageNumber ?? 1),
        playerUserId: String(row.userId),
        playerUsername,
        status: metaStatus,
        retake: getRetakeSummary(playerUser),
      });
    }
    activeStoryMatches.sort((a, b) => b.stageNumber - a.stageNumber);

    const messages = (
      await ctx.db
        .query("agentLobbyMessages")
        .withIndex("by_createdAt")
        .order("desc")
        .take(limit)
    ).reverse();

    const currentAgentName =
      typeof user.retakeAgentName === "string" && user.retakeAgentName.trim()
        ? user.retakeAgentName.trim()
        : null;

    return {
      currentUser: {
        userId: String(user._id),
        username: user.username,
        walletAddress: user.walletAddress ?? null,
        hasRetakeAccount: Boolean(
          user.retakeAgentId && user.retakeUserDbId && user.retakeTokenAddress,
        ),
        pipelineEnabled: user.retakePipelineEnabled === true,
        agentName: currentAgentName,
        tokenAddress: user.retakeTokenAddress ?? null,
        tokenTicker: user.retakeTokenTicker ?? null,
        streamUrl: currentAgentName
          ? `https://retake.tv/${encodeURIComponent(currentAgentName)}`
          : null,
      },
      openLobbies,
      activeStoryMatches,
      messages,
    };
  },
});

export const postLobbyMessage = mutation({
  args: {
    text: v.string(),
    source: v.optional(v.union(v.literal("agent"), v.literal("retake"), v.literal("system"))),
  },
  returns: v.id("agentLobbyMessages"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const normalizedText = args.text.replace(/\s+/g, " ").trim();
    if (!normalizedText) {
      throw new ConvexError("Message cannot be empty.");
    }
    if (normalizedText.length > MAX_MESSAGE_LENGTH) {
      throw new ConvexError(`Message must be ${MAX_MESSAGE_LENGTH} characters or less.`);
    }

    return ctx.db.insert("agentLobbyMessages", {
      userId: user._id,
      senderName: user.username,
      text: normalizedText,
      source: args.source ?? "agent",
      createdAt: Date.now(),
    });
  },
});
