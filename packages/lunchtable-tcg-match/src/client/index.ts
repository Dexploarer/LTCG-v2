import type {
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
import type { api } from "../component/_generated/api.js";

export type RunQueryCtx = {
  runQuery: GenericQueryCtx<GenericDataModel>["runQuery"];
};

export type RunMutationCtx = {
  runMutation: GenericMutationCtx<GenericDataModel>["runMutation"];
};

export type { api };

/**
 * Client for the @lunchtable-tcg/match Convex component.
 *
 * Usage:
 * ```ts
 * import { components } from "@convex/_generated/api";
 * import { LTCGMatch } from "@lunchtable-tcg/match";
 *
 * const match = new LTCGMatch(components.ltcgMatch);
 *
 * // In a mutation:
 * const matchId = await match.createMatch(ctx, { hostId, awayId, ... });
 * await match.startMatch(ctx, { matchId, initialState: JSON.stringify(state) });
 *
 * // In a query:
 * const view = await match.getPlayerView(ctx, { matchId, seat: "host" });
 * ```
 */
export class LTCGMatch {
  constructor(private component: typeof api) {}

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  async createMatch(
    ctx: RunMutationCtx,
    args: {
      hostId: string;
      awayId: string;
      mode: "pvp" | "story";
      hostDeck: string[];
      awayDeck: string[];
      isAIOpponent: boolean;
    }
  ) {
    return await ctx.runMutation(this.component.mutations.createMatch, args);
  }

  async startMatch(
    ctx: RunMutationCtx,
    args: {
      matchId: string;
      initialState: string;
    }
  ) {
    return await ctx.runMutation(this.component.mutations.startMatch, {
      matchId: args.matchId as any,
      initialState: args.initialState,
    });
  }

  async submitAction(
    ctx: RunMutationCtx,
    args: {
      matchId: string;
      command: string;
      seat: "host" | "away";
      cardLookup?: string;
    }
  ) {
    return await ctx.runMutation(this.component.mutations.submitAction, {
      matchId: args.matchId as any,
      command: args.command,
      seat: args.seat,
      cardLookup: args.cardLookup,
    });
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  async getMatchMeta(
    ctx: RunQueryCtx,
    args: { matchId: string }
  ) {
    return await ctx.runQuery(this.component.queries.getMatchMeta, {
      matchId: args.matchId as any,
    });
  }

  async getPlayerView(
    ctx: RunQueryCtx,
    args: {
      matchId: string;
      seat: "host" | "away";
    }
  ) {
    return await ctx.runQuery(this.component.queries.getPlayerView, {
      matchId: args.matchId as any,
      seat: args.seat,
    });
  }

  async getRecentEvents(
    ctx: RunQueryCtx,
    args: {
      matchId: string;
      sinceVersion: number;
    }
  ) {
    return await ctx.runQuery(this.component.queries.getRecentEvents, {
      matchId: args.matchId as any,
      sinceVersion: args.sinceVersion,
    });
  }

  async getActiveMatchByHost(
    ctx: RunQueryCtx,
    args: { hostId: string }
  ) {
    return await ctx.runQuery(this.component.queries.getActiveMatchByHost, {
      hostId: args.hostId,
    });
  }

  async getOpenPrompt(
    ctx: RunQueryCtx,
    args: {
      matchId: string;
      seat: "host" | "away";
    }
  ) {
    return await ctx.runQuery(this.component.queries.getOpenPrompt, {
      matchId: args.matchId as any,
      seat: args.seat,
    });
  }

  /**
   * Temporary compatibility shim for callers still invoking legacy joinMatch API.
   * The current schema models lobby creation through createMatch() and does not
   * expose a separate join flow, so we intentionally reject early with
   * a clear error to prevent silent undefined behavior.
   */
  async joinMatch(
    _ctx: RunMutationCtx,
    _args: {
      matchId: string;
      awayId: string;
      awayDeck: string[];
    }
  ) {
    throw new Error("joinMatch API is deprecated. Use createMatch with both host/away payloads.");
  }

  /**
   * Compatibility alias for legacy consumers expecting this query name.
   */
  async getOpenLobbyByHost(
    ctx: RunQueryCtx,
    args: { hostId: string }
  ) {
    return await this.getActiveMatchByHost(ctx, args);
  }
}
