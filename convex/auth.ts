import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { components } from "./_generated/api";
import { LTCGCards } from "@lunchtable/cards";
import { isValidSignupAvatarPath, normalizeSignupAvatarPath } from "./signupAvatar";

/**
 * Extracts user identity from JWT via ctx.auth.getUserIdentity().
 * Throws if not authenticated.
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Not authenticated");
  const privyId = identity.subject;
  return { privyId, identity };
}

/**
 * Resolves the full user document from the authenticated JWT.
 * Throws if not authenticated or user not found.
 */
export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const { privyId } = await requireAuth(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_privyId", (q) => q.eq("privyId", privyId))
    .first();
  if (!user) throw new ConvexError("User not found. Complete signup first.");
  return user;
}

const RETAKE_OPT_IN_STATES = new Set(["pending", "declined", "accepted"] as const);
type RetakeOptInState = "pending" | "declined" | "accepted";

const normalizeWalletAddress = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed;
};

const normalizeRetakeOptInState = (value: string | undefined): RetakeOptInState => {
  if (value && RETAKE_OPT_IN_STATES.has(value as RetakeOptInState)) {
    return value as RetakeOptInState;
  }
  return "pending";
};

/**
 * Syncs or creates a user based on JWT identity.
 * Uses JWT subject as privyId, no longer accepts it as an arg.
 */
export const syncUser = mutation({
  args: {
    email: v.optional(v.string()),
    walletAddress: v.optional(v.string()),
    walletType: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const { privyId, identity } = await requireAuth(ctx);
    const email = args.email ?? identity.email ?? undefined;
    const walletAddress = normalizeWalletAddress(args.walletAddress);
    const walletType = args.walletType?.trim() || undefined;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_privyId", (q) => q.eq("privyId", privyId))
      .first();

    if (existing) {
      const patch: Record<string, string | number> = {};
      if (email && email !== existing.email) {
        patch.email = email;
      }
      if (walletAddress && walletAddress !== existing.walletAddress) {
        patch.walletAddress = walletAddress;
      }
      if (walletType && walletType !== existing.walletType) {
        patch.walletType = walletType;
      }
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = Date.now();
        await ctx.db.patch(existing._id, patch);
      }
      return existing._id;
    }

    return await ctx.db.insert("users", {
      privyId,
      username: `player_${Date.now()}`,
      email,
      walletAddress,
      walletType,
      retakeOptInStatus: "pending",
      retakePipelineEnabled: false,
      createdAt: Date.now(),
    });
  },
});

/**
 * Returns the current user based on JWT identity.
 * Returns null if not authenticated or user not found.
 */
export const currentUser = query({
  args: {},
  returns: v.union(v.any(), v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return ctx.db
      .query("users")
      .withIndex("by_privyId", (q) => q.eq("privyId", identity.subject))
      .first();
  },
});

const cards = new LTCGCards(components.lunchtable_tcg_cards as any);

const vOnboardingStatus = v.object({
  exists: v.boolean(),
  hasUsername: v.boolean(),
  hasAvatar: v.boolean(),
  hasStarterDeck: v.boolean(),
  hasRetakeChoice: v.boolean(),
  wantsRetake: v.boolean(),
  hasRetakeAccount: v.boolean(),
  walletAddress: v.union(v.string(), v.null()),
});
const RESERVED_DECK_IDS = new Set(["undefined", "null", "skip"]);
const normalizeDeckId = (deckId: string | undefined): string | null => {
  if (!deckId) return null;
  const trimmed = deckId.trim();
  if (!trimmed) return null;
  if (RESERVED_DECK_IDS.has(trimmed.toLowerCase())) return null;
  return trimmed;
};

/**
 * Returns onboarding status for the authenticated user.
 */
export const getOnboardingStatus = query({
  args: {},
  returns: v.union(vOnboardingStatus, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_privyId", (q) => q.eq("privyId", identity.subject))
      .first();
    if (!user)
      return {
        exists: false,
        hasUsername: false,
        hasAvatar: false,
        hasStarterDeck: false,
        hasRetakeChoice: false,
        wantsRetake: false,
        hasRetakeAccount: false,
        walletAddress: null,
      };

    const userDecks = await cards.decks.getUserDecks(ctx, user._id);
    const activeDeckId = normalizeDeckId(user.activeDeckId);
    const hasActiveDeck = activeDeckId
      ? userDecks?.some((deck: { deckId: string }) => deck.deckId === activeDeckId)
      : false;
    const hasUsername = !user.username.startsWith("player_");
    const hasAvatar = isValidSignupAvatarPath(user.avatarPath);
    const optInState = normalizeRetakeOptInState(user.retakeOptInStatus);
    const hasRetakeAccount = Boolean(
      user.retakeAgentId &&
      user.retakeUserDbId &&
      user.retakeTokenAddress,
    );
    const isLegacyComplete = hasUsername && hasAvatar && hasActiveDeck;
    const hasRetakeChoice = optInState !== "pending" || isLegacyComplete;
    const wantsRetake = optInState === "accepted";

    return {
      exists: true,
      hasUsername,
      hasAvatar,
      hasStarterDeck: hasActiveDeck,
      hasRetakeChoice,
      wantsRetake,
      hasRetakeAccount,
      walletAddress: user.walletAddress ?? null,
    };
  },
});

export const setRetakeOnboardingChoice = mutation({
  args: {
    choice: v.union(v.literal("declined"), v.literal("accepted")),
  },
  returns: v.object({
    success: v.boolean(),
    choice: v.union(v.literal("declined"), v.literal("accepted")),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const patch: Record<string, string | boolean | number> = {
      retakeOptInStatus: args.choice,
      updatedAt: now,
    };
    if (args.choice === "declined") {
      patch.retakePipelineEnabled = false;
    }
    await ctx.db.patch(user._id, patch);
    return { success: true, choice: args.choice };
  },
});

export const linkRetakeAccount = mutation({
  args: {
    agentId: v.string(),
    userDbId: v.string(),
    agentName: v.string(),
    walletAddress: v.string(),
    tokenAddress: v.string(),
    tokenTicker: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    streamUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const userWallet = normalizeWalletAddress(user.walletAddress);
    const retakeWallet = normalizeWalletAddress(args.walletAddress);
    if (!userWallet) {
      throw new ConvexError("LunchTable wallet is missing. Sign in again with your wallet.");
    }
    if (!retakeWallet) {
      throw new ConvexError("Retake wallet address is missing.");
    }
    if (userWallet.toLowerCase() !== retakeWallet.toLowerCase()) {
      throw new ConvexError("Retake wallet must match your LunchTable wallet.");
    }

    const agentName = args.agentName.trim();
    const agentId = args.agentId.trim();
    const userDbId = args.userDbId.trim();
    const tokenAddress = args.tokenAddress.trim();
    const tokenTicker = args.tokenTicker.trim().toUpperCase();

    if (!agentName || !agentId || !userDbId || !tokenAddress || !tokenTicker) {
      throw new ConvexError("Retake registration response is incomplete.");
    }

    const now = Date.now();
    await ctx.db.patch(user._id, {
      retakeOptInStatus: "accepted",
      retakeAgentId: agentId,
      retakeUserDbId: userDbId,
      retakeAgentName: agentName,
      retakeWalletAddress: retakeWallet,
      retakeTokenAddress: tokenAddress,
      retakeTokenTicker: tokenTicker,
      retakePipelineEnabled: true,
      retakeLinkedAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      streamUrl: `https://retake.tv/${encodeURIComponent(agentName)}`,
    };
  },
});

export const setRetakePipelineEnabled = mutation({
  args: { enabled: v.boolean() },
  returns: v.object({ success: v.boolean(), enabled: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const hasRetakeAccount = Boolean(
      user.retakeAgentId && user.retakeUserDbId && user.retakeTokenAddress,
    );
    if (args.enabled && !hasRetakeAccount) {
      throw new ConvexError("Link a Retake account before enabling pipeline mode.");
    }
    await ctx.db.patch(user._id, {
      retakePipelineEnabled: args.enabled,
      updatedAt: Date.now(),
    });
    return { success: true, enabled: args.enabled };
  },
});

export const getRetakeProfile = query({
  args: {},
  returns: v.union(
    v.object({
      hasRetakeAccount: v.boolean(),
      pipelineEnabled: v.boolean(),
      agentName: v.union(v.string(), v.null()),
      tokenAddress: v.union(v.string(), v.null()),
      tokenTicker: v.union(v.string(), v.null()),
      streamUrl: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_privyId", (q) => q.eq("privyId", identity.subject))
      .first();
    if (!user) return null;

    const hasRetakeAccount = Boolean(
      user.retakeAgentId && user.retakeUserDbId && user.retakeTokenAddress,
    );
    const agentName = user.retakeAgentName ?? null;
    return {
      hasRetakeAccount,
      pipelineEnabled: user.retakePipelineEnabled === true,
      agentName,
      tokenAddress: user.retakeTokenAddress ?? null,
      tokenTicker: user.retakeTokenTicker ?? null,
      streamUrl: agentName ? `https://retake.tv/${encodeURIComponent(agentName)}` : null,
    };
  },
});

/**
 * Sets the username for the authenticated user.
 * Validates format and uniqueness.
 */
export const setUsername = mutation({
  args: { username: v.string() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    // Validate: 3-20 chars, alphanumeric + underscores
    const trimmed = args.username.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
      throw new ConvexError(
        "Username must be 3-20 characters, alphanumeric and underscores only."
      );
    }
    // Check uniqueness
    const taken = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", trimmed))
      .first();
    if (taken && taken._id !== user._id) {
      throw new ConvexError("Username is already taken.");
    }
    await ctx.db.patch(user._id, { username: trimmed });
    return { success: true };
  },
});

/**
 * Sets the signup avatar path for the authenticated user.
 */
export const setAvatarPath = mutation({
  args: { avatarPath: v.string() },
  returns: v.object({ success: v.boolean(), avatarPath: v.string() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const avatarPath = normalizeSignupAvatarPath(args.avatarPath);
    if (!avatarPath) throw new ConvexError("Invalid avatar selection.");

    await ctx.db.patch(user._id, { avatarPath });
    return { success: true, avatarPath };
  },
});
