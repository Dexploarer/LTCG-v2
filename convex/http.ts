import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { assertMatchParticipant, type MatchSeat } from "./matchAccess";

const http = httpRouter();

// CORS configuration
const ALLOWED_HEADERS = ["Content-Type", "Authorization"];

/**
 * Wrap a handler with CORS headers
 */
function corsHandler(
  handler: (ctx: any, request: Request) => Promise<Response>
): (ctx: any, request: Request) => Promise<Response> {
  return async (ctx, request) => {
    // Handle preflight OPTIONS request
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": ALLOWED_HEADERS.join(", "),
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Call actual handler
    const response = await handler(ctx, request);
    
    // Add CORS headers to response
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set("Access-Control-Allow-Headers", ALLOWED_HEADERS.join(", "));
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}

/**
 * Register a route with CORS support (includes OPTIONS preflight)
 */
function corsRoute({
  path,
  method,
  handler,
}: {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  handler: (ctx: any, request: Request) => Promise<Response>;
}) {
  // Register the actual method
  http.route({
    path,
    method,
    handler: httpAction(corsHandler(handler)),
  });
  // Register OPTIONS preflight for the same path
  if (!registeredOptions.has(path)) {
    registeredOptions.add(path);
    http.route({
      path,
      method: "OPTIONS",
      handler: httpAction(corsHandler(async () => new Response(null, { status: 204 }))),
    });
  }
}

const registeredOptions = new Set<string>();

// ── Agent Auth Middleware ─────────────────────────────────────────

async function authenticateAgent(
  ctx: { runQuery: any },
  request: Request,
) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const apiKey = authHeader.slice(7);
  if (!apiKey.startsWith("ltcg_")) {
    return null;
  }

  // Hash the key and look up
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const apiKeyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const agent = await ctx.runQuery(api.agentAuth.getAgentByKeyHash, { apiKeyHash });
  if (!agent || !agent.isActive) return null;

  return agent;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function parseLegacyResponseType(
  responseType: unknown,
): boolean | undefined {
  if (typeof responseType === "boolean") return responseType;
  if (typeof responseType !== "string") return undefined;

  const normalized = responseType.toLowerCase().trim();
  if (normalized === "pass") return true;
  if (normalized === "play" || normalized === "continue" || normalized === "no") {
    return false;
  }

  return undefined;
}

function normalizeGameCommand(rawCommand: unknown): unknown {
  if (!isPlainObject(rawCommand)) {
    return rawCommand;
  }

  const command = { ...rawCommand };

  const legacyToCanonical: Record<string, string> = {
    cardInstanceId: "cardId",
    attackerInstanceId: "attackerId",
    targetInstanceId: "targetId",
    newPosition: "position",
  };

  for (const [legacyKey, canonicalKey] of Object.entries(legacyToCanonical)) {
    if (legacyKey in command && !(canonicalKey in command)) {
      command[canonicalKey] = command[legacyKey];
    }
    if (legacyKey in command) {
      delete command[legacyKey];
    }
  }

  if (
    command.type === "CHAIN_RESPONSE" &&
    !("pass" in command) &&
    "responseType" in command
  ) {
    const parsedPass = parseLegacyResponseType(command.responseType);
    if (parsedPass !== undefined) {
      command.pass = parsedPass;
      delete command.responseType;
    }
  }

  return command;
}

type MatchMetaSummary = Record<string, unknown> & {
  hostId?: string | null;
  awayId?: string | null;
  status?: string | null;
  mode?: string | null;
  winner?: MatchSeat | null;
  endReason?: string | null;
};

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readOptionalWinner(value: unknown): MatchSeat | null {
  return value === "host" || value === "away" ? value : null;
}

function normalizeMatchMeta(raw: unknown): MatchMetaSummary {
  if (!isPlainObject(raw)) {
    throw new Error("Match metadata is malformed.");
  }

  return {
    ...raw,
    hostId: readOptionalString(raw.hostId),
    awayId: readOptionalString(raw.awayId),
    status: readOptionalString(raw.status),
    mode: readOptionalString(raw.mode),
    winner: readOptionalWinner(raw.winner),
    endReason: readOptionalString(raw.endReason),
  };
}

export async function resolveMatchAndSeat(
  ctx: { runQuery: any },
  agentUserId: string,
  matchId: string,
  requestedSeat?: string,
) {
  const rawMeta = await ctx.runQuery(api.game.getMatchMeta, {
    matchId,
    actorUserId: agentUserId as any,
  });
  if (!rawMeta) {
    throw new Error("Match not found");
  }
  const meta = normalizeMatchMeta(rawMeta);

  if (requestedSeat !== undefined && requestedSeat !== "host" && requestedSeat !== "away") {
    throw new Error("seat must be 'host' or 'away'.");
  }

  const seat = requestedSeat as MatchSeat | undefined;
  const resolvedSeat = assertMatchParticipant(meta, agentUserId, seat);
  return { meta, seat: resolvedSeat };
}

// ── Routes ───────────────────────────────────────────────────────

corsRoute({
  path: "/api/agent/register",
  method: "POST",
  handler: async (ctx, request) => {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.length < 1 || name.length > 50) {
      return errorResponse("Name is required (1-50 characters).");
    }

    // Generate a random API key
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const keyBody = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const apiKey = `ltcg_${keyBody}`;
    const apiKeyPrefix = `ltcg_${keyBody.slice(0, 8)}...`;

    // Hash the key for storage
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const apiKeyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const result = await ctx.runMutation(api.agentAuth.registerAgent, {
      name,
      apiKeyHash,
      apiKeyPrefix,
    });

    return jsonResponse({
      agentId: result.agentId,
      userId: result.userId,
      apiKey, // Shown once — cannot be retrieved again
      apiKeyPrefix,
      message: "Save your API key! It cannot be retrieved again.",
    });
  },
});

corsRoute({
  path: "/api/agent/me",
  method: "GET",
  handler: async (ctx, request) => {
    const agent = await authenticateAgent(ctx, request);
    if (!agent) return errorResponse("Unauthorized", 401);

    // Check if there's an unread daily briefing
    const briefing = await ctx.runQuery(api.dailyBriefing.getAgentDailyBriefing, {
      agentId: agent._id,
      userId: agent.userId,
    });

    return jsonResponse({
      id: agent._id,
      name: agent.name,
      userId: agent.userId,
      apiKeyPrefix: agent.apiKeyPrefix,
      isActive: agent.isActive,
      createdAt: agent.createdAt,
      dailyBriefing: briefing?.active
        ? {
            available: true,
            checkedIn: briefing.checkedIn,
            event: briefing.event,
            announcement: briefing.announcement,
          }
        : { available: false, checkedIn: false },
    });
  },
});

corsRoute({
  path: "/api/agent/game/start",
  method: "POST",
  handler: async (ctx, request) => {
    const agent = await authenticateAgent(ctx, request);
    if (!agent) return errorResponse("Unauthorized", 401);

    const body = await request.json();
    const { chapterId, stageNumber } = body;

    if (!chapterId || typeof chapterId !== "string") {
      return errorResponse("chapterId is required.");
    }

    try {
      const result = await ctx.runMutation(api.agentAuth.agentStartBattle, {
        agentUserId: agent.userId,
        chapterId,
        stageNumber: typeof stageNumber === "number" ? stageNumber : undefined,
      });
      return jsonResponse(result);
    } catch (e: any) {
      return errorResponse(e.message, 422);
    }
  },
});

corsRoute({
  path: "/api/agent/game/start-duel",
  method: "POST",
  handler: async (ctx, request) => {
    const agent = await authenticateAgent(ctx, request);
    if (!agent) return errorResponse("Unauthorized", 401);

    try {
      const result = await ctx.runMutation(api.agentAuth.agentStartDuel, {
        agentUserId: agent.userId,
      });
      return jsonResponse(result);
    } catch (e: any) {
      return errorResponse(e.message, 422);
    }
  },
});

corsRoute({
  path: "/api/agent/game/join",
  method: "POST",
  handler: async (ctx, request) => {
    const agent = await authenticateAgent(ctx, request);
    if (!agent) return errorResponse("Unauthorized", 401);

    const body = await request.json();
    const { matchId } = body;

    if (!matchId || typeof matchId !== "string") {
      return errorResponse("matchId is required.");
    }

    try {
      const result = await ctx.runMutation(api.agentAuth.agentJoinMatch, {
        agentUserId: agent.userId,
        matchId,
      });
      return jsonResponse(result);
    } catch (e: any) {
      return errorResponse(e.message, 422);
    }
  },
});

corsRoute({
  path: "/api/agent/game/action",
  method: "POST",
  handler: async (ctx, request) => {
    const agent = await authenticateAgent(ctx, request);
    if (!agent) return errorResponse("Unauthorized", 401);

    const body = await request.json();
    const {
      matchId,
      command,
      seat: requestedSeat,
      expectedVersion,
    } = body;

    if (!matchId || !command) {
      return errorResponse("matchId and command are required.");
    }
    if (expectedVersion !== undefined && typeof expectedVersion !== "number") {
      return errorResponse("expectedVersion must be a number.");
    }

    let resolvedSeat: MatchSeat;
    try {
      ({ seat: resolvedSeat } = await resolveMatchAndSeat(
        ctx,
        agent.userId,
        matchId,
        requestedSeat,
      ));
    } catch (e: any) {
      return errorResponse(e.message, 422);
    }

    let parsedCommand = command;
    if (typeof command === "string") {
      try {
        parsedCommand = JSON.parse(command);
      } catch {
        return errorResponse("command must be valid JSON or a JSON-compatible object.");
      }
    }
    if (!isPlainObject(parsedCommand)) {
      return errorResponse("command must be an object.");
    }

    const normalizedCommand = normalizeGameCommand(parsedCommand);
    if (!isPlainObject(normalizedCommand)) {
      return errorResponse("command must be an object after normalization.");
    }

    try {
      const result = await ctx.runMutation(api.game.submitActionWithClient, {
        matchId,
        command: JSON.stringify(normalizedCommand),
        seat: resolvedSeat,
        actorUserId: agent.userId as any,
      });
      return jsonResponse(result);
    } catch (e: any) {
      return errorResponse(e.message, 422);
    }
  },
});

corsRoute({
  path: "/api/agent/game/view",
  method: "GET",
  handler: async (ctx, request) => {
    const agent = await authenticateAgent(ctx, request);
    if (!agent) return errorResponse("Unauthorized", 401);

    const url = new URL(request.url);
    const matchId = url.searchParams.get("matchId");
    const requestedSeat = url.searchParams.get("seat") ?? undefined;

    if (!matchId) {
      return errorResponse("matchId query parameter is required.");
    }

    let seat: MatchSeat;
    try {
      ({ seat } = await resolveMatchAndSeat(
        ctx,
        agent.userId,
        matchId,
        requestedSeat,
      ));
    } catch (e: any) {
      return errorResponse(e.message, 422);
    }

    try {
      const view = await ctx.runQuery(api.game.getPlayerView, {
        matchId,
        seat,
        actorUserId: agent.userId as any,
      });
      if (!view) return errorResponse("Match state not found", 404);
      // getPlayerView returns a JSON string — parse before wrapping
      const parsed = typeof view === "string" ? JSON.parse(view) : view;
      return jsonResponse(parsed);
    } catch (e: any) {
      return errorResponse(e.message, 422);
    }
  },
});

// ── Agent Setup Routes ──────────────────────────────────────────

corsRoute({
  path: "/api/agent/game/chapters",
  method: "GET",
  handler: async (ctx, request) => {
    const agent = await authenticateAgent(ctx, request);
    if (!agent) return errorResponse("Unauthorized", 401);

    const chapters = await ctx.runQuery(api.game.getChapters, {});
    return jsonResponse(chapters);
  },
});

corsRoute({
  path: "/api/agent/game/starter-decks",
  method: "GET",
  handler: async (ctx, request) => {
    const agent = await authenticateAgent(ctx, request);
    if (!agent) return errorResponse("Unauthorized", 401);

    const decks = await ctx.runQuery(api.game.getStarterDecks, {});
    return jsonResponse(decks);
  },
});

corsRoute({
  path: "/api/agent/game/select-deck",
  method: "POST",
  handler: async (ctx, request) => {
    const agent = await authenticateAgent(ctx, request);
    if (!agent) return errorResponse("Unauthorized", 401);

    const body = await request.json();
    const { deckCode } = body;

    if (!deckCode || typeof deckCode !== "string") {
      return errorResponse("deckCode is required.");
    }

    try {
      const result = await ctx.runMutation(api.agentAuth.agentSelectStarterDeck, {
        agentUserId: agent.userId,
        deckCode,
      });
      return jsonResponse(result);
    } catch (e: any) {
      return errorResponse(e.message, 422);
    }
  },
});

// ── Agent Story Endpoints ──────────────────────────────────────

corsRoute({
  path: "/api/agent/story/progress",
  method: "GET",
  handler: async (ctx, request) => {
    const agent = await authenticateAgent(ctx, request);
    if (!agent) return errorResponse("Unauthorized", 401);

    const result = await ctx.runQuery(api.game.getFullStoryProgress, {});
    return jsonResponse(result);
  },
});

corsRoute({
  path: "/api/agent/story/stage",
  method: "GET",
  handler: async (ctx, request) => {
    const agent = await authenticateAgent(ctx, request);
    if (!agent) return errorResponse("Unauthorized", 401);

    const url = new URL(request.url);
    const chapterId = url.searchParams.get("chapterId");
    const stageNumber = url.searchParams.get("stageNumber");

    if (!chapterId || !stageNumber) {
      return errorResponse("chapterId and stageNumber query params required.");
    }

    const stage = await ctx.runQuery(api.game.getStageWithNarrative, {
      chapterId,
      stageNumber: parseInt(stageNumber, 10),
    });

    if (!stage) return errorResponse("Stage not found", 404);
    return jsonResponse(stage);
  },
});

corsRoute({
  path: "/api/agent/story/complete-stage",
  method: "POST",
  handler: async (ctx, request) => {
    const agent = await authenticateAgent(ctx, request);
    if (!agent) return errorResponse("Unauthorized", 401);

    const body = await request.json();
    const { matchId } = body;

    if (!matchId || typeof matchId !== "string") {
      return errorResponse("matchId is required.");
    }

    try {
      const result = await ctx.runMutation(api.game.completeStoryStage, {
        matchId,
        actorUserId: agent.userId as any,
      });
      return jsonResponse(result);
    } catch (e: any) {
      return errorResponse(e.message, 422);
    }
  },
});

corsRoute({
  path: "/api/agent/game/match-status",
  method: "GET",
  handler: async (ctx, request) => {
    const agent = await authenticateAgent(ctx, request);
    if (!agent) return errorResponse("Unauthorized", 401);

    const url = new URL(request.url);
    const matchId = url.searchParams.get("matchId");

    if (!matchId) {
      return errorResponse("matchId query parameter is required.");
    }

    try {
      const { meta: validatedMeta, seat } = await resolveMatchAndSeat(
        ctx,
        agent.userId,
        matchId,
      );
      const storyCtx = await ctx.runQuery(api.game.getStoryMatchContext, { matchId });

      return jsonResponse({
        matchId,
        status: validatedMeta.status ?? null,
        mode: validatedMeta.mode ?? null,
        winner: validatedMeta.winner ?? null,
        endReason: validatedMeta.endReason ?? null,
        isGameOver: validatedMeta.status === "ended",
        hostId: validatedMeta.hostId ?? null,
        awayId: validatedMeta.awayId ?? null,
        seat,
        chapterId: storyCtx?.chapterId ?? null,
        stageNumber: storyCtx?.stageNumber ?? null,
        outcome: storyCtx?.outcome ?? null,
        starsEarned: storyCtx?.starsEarned ?? null,
      });
    } catch (e: any) {
      return errorResponse(e.message, 422);
    }
  },
});

// ── Agent Active Match ──────────────────────────────────────

corsRoute({
  path: "/api/agent/active-match",
  method: "GET",
  handler: async (ctx, request) => {
    const agent = await authenticateAgent(ctx, request);
    if (!agent) return errorResponse("Unauthorized", 401);

    const activeMatch = await ctx.runQuery(api.game.getActiveMatchByHost, {
      hostId: agent.userId,
    });

    if (!activeMatch) {
      return jsonResponse({ matchId: null, status: null });
    }

    let seat: MatchSeat;
    try {
      ({ seat } = await resolveMatchAndSeat(ctx, agent.userId, activeMatch._id));
    } catch (e: any) {
      return errorResponse(e.message, 422);
    }

    return jsonResponse({
      matchId: activeMatch._id,
      status: activeMatch.status,
      mode: activeMatch.mode,
      createdAt: activeMatch.createdAt,
      hostId: (activeMatch as any).hostId,
      awayId: (activeMatch as any).awayId,
      seat,
    });
  },
});

// ── Agent Daily Briefing ─────────────────────────────────────

corsRoute({
  path: "/api/agent/daily-briefing",
  method: "GET",
  handler: async (ctx, request) => {
    const agent = await authenticateAgent(ctx, request);
    if (!agent) return errorResponse("Unauthorized", 401);

    const briefing = await ctx.runQuery(api.dailyBriefing.getAgentDailyBriefing, {
      agentId: agent._id,
      userId: agent.userId,
    });

    return jsonResponse(briefing);
  },
});

corsRoute({
  path: "/api/agent/checkin",
  method: "POST",
  handler: async (ctx, request) => {
    const agent = await authenticateAgent(ctx, request);
    if (!agent) return errorResponse("Unauthorized", 401);

    // Record check-in
    const checkinResult = await ctx.runMutation(api.dailyBriefing.agentCheckin, {
      agentId: agent._id,
      userId: agent.userId,
    });

    // Return full briefing with check-in status
    const briefing = await ctx.runQuery(api.dailyBriefing.getAgentDailyBriefing, {
      agentId: agent._id,
      userId: agent.userId,
    });

    return jsonResponse({
      ...briefing,
      checkinStatus: checkinResult,
    });
  },
});

async function handleTelegramStartMessage(
  ctx: { runMutation: any },
  message: TelegramMessage,
) {
  const chatId = message.chat?.id;
  if (!chatId) return;
  const text = (message.text ?? "").trim();
  const payload = text.split(/\s+/, 2)[1] ?? "";
  const matchId = payload.startsWith("m_") ? parseTelegramMatchIdToken(payload.slice(2)) : null;

  if (message.from?.id) {
    await ctx.runMutation(internalApi.telegram.touchTelegramIdentity, {
      telegramUserId: String(message.from.id),
      username: message.from.username,
      firstName: message.from.first_name,
      privateChatId: message.chat?.type === "private" ? String(chatId) : undefined,
    });
  }

  const intro = [
    "<b>LunchTable Telegram</b>",
    "Open the Mini App to link your account and play full matches.",
    matchId ? `Match requested: <code>${escapeTelegramHtml(matchId)}</code>` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: "Open Mini App", url: getTelegramDeepLink(matchId ?? undefined) }],
      ...(matchId ? [[{ text: "Join Lobby Inline", callback_data: `join_lobby:${matchId}` }]] : []),
    ],
  };

  await telegramSendMessage(chatId, intro, keyboard);
}

async function handleTelegramInlineQuery(
  inlineQuery: TelegramInlineQuery,
) {
  const queryText = (inlineQuery.query ?? "").trim();
  const requestedMatchId = parseTelegramMatchIdToken(queryText);
  const results: unknown[] = [];
  const openMiniAppButton = { text: "Open Mini App", url: getTelegramDeepLink() };

  results.push({
    type: "article",
    id: "create_lobby",
    title: "Create PvP Lobby",
    description: "Create a waiting PvP match from inline chat.",
    input_message_content: {
      message_text: "Create a LunchTable PvP lobby:",
    },
    reply_markup: {
      inline_keyboard: [
        [{ text: "Create Lobby", callback_data: "create_lobby" }],
        [openMiniAppButton],
      ],
    },
  });

  if (requestedMatchId) {
    results.push({
      type: "article",
      id: `join_${requestedMatchId}`,
      title: `Join Lobby ${requestedMatchId}`,
      description: "Join an existing waiting PvP lobby.",
      input_message_content: {
        message_text: `Join LunchTable lobby <code>${escapeTelegramHtml(requestedMatchId)}</code>`,
        parse_mode: "HTML",
      },
      reply_markup: {
        inline_keyboard: [
          [{ text: "Join Lobby", callback_data: `join_lobby:${requestedMatchId}` }],
          [openMiniAppButton],
        ],
      },
    });
  }

  results.push({
    type: "article",
    id: "open_miniapp",
    title: "Open Mini App",
    description: "Launch LunchTable Mini App in Telegram.",
    input_message_content: {
      message_text: "Open LunchTable Mini App:",
    },
    reply_markup: {
      inline_keyboard: [[openMiniAppButton]],
    },
  });

  await telegramAnswerInlineQuery(inlineQuery.id, results);
}

async function handleTelegramCallbackQuery(
  ctx: { runMutation: any; runQuery: any },
  callbackQuery: TelegramCallbackQuery,
) {
  const data = (callbackQuery.data ?? "").trim();
  if (!data) {
    await telegramAnswerCallbackQuery(callbackQuery.id, "No callback payload.");
    return;
  }

  if (data.startsWith("refresh:")) {
    try {
      const { userId } = await requireLinkedTelegramUser(ctx, callbackQuery);
      const { matchId, page } = parseRefreshPayload(data.slice("refresh:".length));
      if (!matchId) throw new Error("Invalid match id.");
      const summary = await buildTelegramMatchSummary(ctx, { matchId, userId, page });
      await telegramEditCallbackMessage(callbackQuery, summary.text, summary.replyMarkup);
      await telegramAnswerCallbackQuery(callbackQuery.id, "Refreshed.");
    } catch (error: any) {
      await telegramAnswerCallbackQuery(callbackQuery.id, error?.message ?? "Refresh failed.", true);
    }
    return;
  }

  if (data === "create_lobby") {
    try {
      const { userId } = await requireLinkedTelegramUser(ctx, callbackQuery);
      const result = await ctx.runMutation(internal.game.createPvpLobbyForUser, {
        userId,
        client: "telegram_inline",
      });
      const summary = await buildTelegramMatchSummary(ctx, { matchId: result.matchId, userId });
      await telegramEditCallbackMessage(callbackQuery, summary.text, summary.replyMarkup);
      await telegramAnswerCallbackQuery(callbackQuery.id, "Lobby ready.");
    } catch (error: any) {
      await telegramAnswerCallbackQuery(callbackQuery.id, error?.message ?? "Failed to create lobby.", true);
    }
    return;
  }

  if (data.startsWith("join_lobby:")) {
    try {
      const { userId } = await requireLinkedTelegramUser(ctx, callbackQuery);
      const matchId = parseTelegramMatchIdToken(data.slice("join_lobby:".length));
      if (!matchId) throw new Error("Invalid match id.");
      await ctx.runMutation(internal.game.joinPvpLobbyForUser, {
        userId,
        matchId,
        client: "telegram_inline",
      });
      const summary = await buildTelegramMatchSummary(ctx, { matchId, userId });
      await telegramEditCallbackMessage(callbackQuery, summary.text, summary.replyMarkup);
      await telegramAnswerCallbackQuery(callbackQuery.id, "Joined match.");
    } catch (error: any) {
      await telegramAnswerCallbackQuery(callbackQuery.id, error?.message ?? "Failed to join.", true);
    }
    return;
  }

  if (data.startsWith("act:")) {
    try {
      const { userId } = await requireLinkedTelegramUser(ctx, callbackQuery);
      const token = data.slice("act:".length);
      const tokenPayload = await ctx.runQuery(internalApi.telegram.getTelegramActionToken, {
        token,
      });
      if (!tokenPayload) {
        throw new Error("Action expired. Refresh the controls.");
      }
      if (tokenPayload.expiresAt < Date.now()) {
        await ctx.runMutation(internalApi.telegram.deleteTelegramActionToken, { token });
        throw new Error("Action token expired. Refresh and try again.");
      }

      const meta = await ctx.runQuery(api.game.getMatchMeta, { matchId: tokenPayload.matchId });
      if (!meta) {
        throw new Error("Match not found.");
      }
      const seatOwner = tokenPayload.seat === "host" ? meta.hostId : meta.awayId;
      if (seatOwner !== userId) {
        throw new Error("You are not authorized to execute this action.");
      }

      const command = parseJsonObject(tokenPayload.commandJson);
      if (!command) throw new Error("Action payload is invalid.");

      await ctx.runMutation(internal.game.submitActionWithClientForUser, {
        userId,
        matchId: tokenPayload.matchId,
        command: JSON.stringify(command),
        seat: tokenPayload.seat,
        expectedVersion: tokenPayload.expectedVersion ?? undefined,
        client: "telegram_inline",
      });
      await ctx.runMutation(internalApi.telegram.deleteTelegramActionToken, { token });

      const summary = await buildTelegramMatchSummary(ctx, {
        matchId: tokenPayload.matchId,
        userId,
      });
      await telegramEditCallbackMessage(callbackQuery, summary.text, summary.replyMarkup);
      await telegramAnswerCallbackQuery(callbackQuery.id, "Action submitted.");
    } catch (error: any) {
      await telegramAnswerCallbackQuery(callbackQuery.id, error?.message ?? "Action failed.", true);
    }
    return;
  }

  await telegramAnswerCallbackQuery(callbackQuery.id, "Unsupported action.");
}

async function handleTelegramUpdate(
  ctx: { runMutation: any; runQuery: any },
  update: TelegramUpdate,
) {
  if (update.message?.text?.startsWith("/start")) {
    await handleTelegramStartMessage(ctx, update.message);
    return;
  }

  if (update.inline_query) {
    await handleTelegramInlineQuery(update.inline_query);
    return;
  }

  if (update.callback_query) {
    await handleTelegramCallbackQuery(ctx, update.callback_query);
  }
}

http.route({
  path: "/api/telegram/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const configuredSecret = (process.env.TELEGRAM_WEBHOOK_SECRET ?? "").trim();
    const receivedSecret = (request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "").trim();
    if (!configuredSecret || !timingSafeEqual(configuredSecret, receivedSecret)) {
      return new Response("Unauthorized", { status: 401 });
    }

    let payload: TelegramUpdate;
    try {
      payload = (await request.json()) as TelegramUpdate;
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    const updateId = typeof payload.update_id === "number" ? payload.update_id : null;
    if (updateId !== null) {
      const alreadyProcessed = await ctx.runQuery(internalApi.telegram.hasProcessedTelegramUpdate, {
        updateId,
      });
      if (alreadyProcessed) {
        return jsonResponse({ ok: true, duplicate: true });
      }
    }

    try {
      await handleTelegramUpdate(ctx, payload);
      if (updateId !== null) {
        await ctx.runMutation(internalApi.telegram.markTelegramUpdateProcessed, { updateId });
      }
      return jsonResponse({ ok: true });
    } catch (error: any) {
      console.error("telegram_webhook_error", error);
      return errorResponse(error?.message ?? "Webhook processing failed.", 500);
    }
  }),
});

export default http;
