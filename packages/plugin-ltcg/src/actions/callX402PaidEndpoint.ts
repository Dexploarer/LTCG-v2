/**
 * Action: CALL_X402_PAID_ENDPOINT
 *
 * Makes a paid API request via x402 using the agent's Solana wallet signer.
 * The private key never leaves runtime settings and is never logged by this action.
 */

import {
  callX402PaidEndpoint,
  getX402Status,
  sanitizeX402Error,
} from "../x402.js";
import type {
  Action,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
} from "../types.js";

type PaidEndpointOptions = {
  url?: unknown;
  method?: unknown;
  headers?: unknown;
  body?: unknown;
  timeoutMs?: unknown;
  maxResponseChars?: unknown;
};

const URL_REGEX = /(https?:\/\/[^\s"'<>]+)/i;
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

function firstUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  return match?.[1] ?? null;
}

function parseMethod(value: unknown): string {
  if (typeof value !== "string") return "GET";
  const method = value.trim().toUpperCase();
  return ALLOWED_METHODS.has(method) ? method : "GET";
}

function parseHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key, val]) => typeof key === "string" && typeof val === "string")
    .map(([key, val]) => [key, val as string] as const);
  return Object.fromEntries(entries);
}

function parseTimeout(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1000, Math.floor(value));
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return Math.max(1000, Math.floor(parsed));
  }
  return undefined;
}

function parseMaxChars(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(200, Math.min(10_000, Math.floor(value)));
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return Math.max(200, Math.min(10_000, Math.floor(parsed)));
    }
  }
  return 1400;
}

function truncateBody(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n...[truncated]`;
}

export const callX402PaidEndpointAction: Action = {
  name: "CALL_X402_PAID_ENDPOINT",
  similes: [
    "CALL_PAID_API",
    "CALL_X402_ENDPOINT",
    "X402_FETCH",
    "PAY_AND_FETCH_API",
  ],
  description:
    "Call a paid x402 endpoint using the configured Solana wallet signer (supports OpenClawd and milady/elizaOS runtimes).",

  validate: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
  ) => {
    const status = await getX402Status(runtime);
    return status.enabled && status.privateKeyConfigured;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const status = await getX402Status(runtime);
    if (!status.enabled) {
      const text = "x402 is disabled. Set LTCG_X402_ENABLED=true.";
      if (callback) await callback({ text, action: "CALL_X402_PAID_ENDPOINT" });
      return { success: false, error: text };
    }
    if (!status.privateKeyConfigured) {
      const text = "Missing LTCG_X402_SOLANA_PRIVATE_KEY_B58 for x402 payments.";
      if (callback) await callback({ text, action: "CALL_X402_PAID_ENDPOINT" });
      return { success: false, error: text };
    }

    const optionsTyped = (options ?? {}) as PaidEndpointOptions;
    const messageText = message.content?.text ?? "";
    const url =
      (typeof optionsTyped.url === "string" ? optionsTyped.url.trim() : "") ||
      firstUrl(messageText) ||
      "";

    if (!url) {
      const text =
        "No paid endpoint URL provided. Pass options.url or include a full https:// URL in the prompt.";
      if (callback) await callback({ text, action: "CALL_X402_PAID_ENDPOINT" });
      return { success: false, error: text };
    }

    const method = parseMethod(optionsTyped.method);
    const headers = parseHeaders(optionsTyped.headers);
    const timeoutMs = parseTimeout(optionsTyped.timeoutMs);
    const maxResponseChars = parseMaxChars(optionsTyped.maxResponseChars);

    try {
      const paid = await callX402PaidEndpoint(runtime, {
        url,
        method,
        headers,
        body: optionsTyped.body,
        timeoutMs,
      });

      const bodyPreview = truncateBody(paid.bodyText || "", maxResponseChars);
      const text = [
        `x402 paid request ${paid.ok ? "succeeded" : "completed"} (${paid.status}).`,
        `Network: ${paid.network} • Wallet: ${paid.walletAddress}`,
        bodyPreview.length > 0 ? `Response:\n${bodyPreview}` : "Response body is empty.",
      ].join("\n");

      if (callback) await callback({ text, action: "CALL_X402_PAID_ENDPOINT" });

      return {
        success: true,
        data: {
          status: paid.status,
          ok: paid.ok,
          network: paid.network,
          walletAddress: paid.walletAddress,
          contentType: paid.contentType,
          bodyPreview,
        },
      };
    } catch (error) {
      const messageOut = sanitizeX402Error(error);
      if (callback) {
        await callback({
          text: `x402 paid request failed: ${messageOut}`,
          action: "CALL_X402_PAID_ENDPOINT",
        });
      }
      return { success: false, error: messageOut };
    }
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "Call this paid endpoint: https://api.example.com/premium/stats" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Calling paid x402 endpoint with the configured Solana wallet.",
          action: "CALL_X402_PAID_ENDPOINT",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "POST paid endpoint with JSON body." },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Running x402 paid POST request now.",
          action: "CALL_X402_PAID_ENDPOINT",
        },
      },
    ],
  ],
};
