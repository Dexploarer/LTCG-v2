import { base58 } from "@scure/base";
import {
  createKeyPairSignerFromBytes,
  createKeyPairSignerFromPrivateKeyBytes,
} from "@solana/kit";
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import {
  SOLANA_DEVNET_CAIP2,
  SOLANA_MAINNET_CAIP2,
  SOLANA_TESTNET_CAIP2,
  toClientSvmSigner,
} from "@x402/svm";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { ExactSvmSchemeV1 } from "@x402/svm/v1";
import { getEnvValue } from "./env.js";
import type { IAgentRuntime } from "./types.js";

type X402SolanaNetwork = "mainnet" | "devnet" | "testnet";

type X402Config = {
  enabled: boolean;
  network: X402SolanaNetwork;
  rpcUrl: string | null;
  privateKeyBase58: string | null;
};

type X402ClientContext = {
  network: X402SolanaNetwork;
  walletAddress: string;
  paidFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

export type X402Status = {
  enabled: boolean;
  network: X402SolanaNetwork;
  rpcUrlConfigured: boolean;
  privateKeyConfigured: boolean;
  ready: boolean;
  walletAddress: string | null;
  error: string | null;
};

export type X402PaidRequest = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
};

export type X402PaidResponse = {
  status: number;
  ok: boolean;
  contentType: string;
  bodyText: string;
  walletAddress: string;
  network: X402SolanaNetwork;
};

const DEFAULT_NETWORK: X402SolanaNetwork = "mainnet";
const DEFAULT_TIMEOUT_MS = 30_000;

const NETWORK_TO_CAIP2: Record<X402SolanaNetwork, string> = {
  mainnet: SOLANA_MAINNET_CAIP2,
  devnet: SOLANA_DEVNET_CAIP2,
  testnet: SOLANA_TESTNET_CAIP2,
};

const NETWORK_TO_V1: Record<X402SolanaNetwork, string> = {
  mainnet: "solana",
  devnet: "solana-devnet",
  testnet: "solana-testnet",
};

let cachedFingerprint: string | null = null;
let cachedContextPromise: Promise<X402ClientContext> | null = null;

function readSetting(runtime: IAgentRuntime, key: string): string | undefined {
  return runtime.getSetting(key) || getEnvValue(key);
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function parseNetwork(value: string | undefined): X402SolanaNetwork {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "devnet" || normalized === "testnet" || normalized === "mainnet") {
    return normalized;
  }
  return DEFAULT_NETWORK;
}

function readConfig(runtime: IAgentRuntime): X402Config {
  const rpcRaw = readSetting(runtime, "LTCG_X402_SOLANA_RPC_URL")?.trim();
  const keyRaw = readSetting(runtime, "LTCG_X402_SOLANA_PRIVATE_KEY_B58")?.trim();
  return {
    enabled: parseBoolean(readSetting(runtime, "LTCG_X402_ENABLED")),
    network: parseNetwork(readSetting(runtime, "LTCG_X402_SOLANA_NETWORK")),
    rpcUrl: rpcRaw && rpcRaw.length > 0 ? rpcRaw : null,
    privateKeyBase58: keyRaw && keyRaw.length > 0 ? keyRaw : null,
  };
}

function buildFingerprint(config: X402Config): string {
  return [
    config.enabled ? "1" : "0",
    config.network,
    config.rpcUrl ?? "",
    config.privateKeyBase58 ?? "",
  ].join("|");
}

function normalizePrivateKeyBytes(encoded: string): Uint8Array {
  let decoded: Uint8Array;
  try {
    decoded = base58.decode(encoded);
  } catch {
    throw new Error("Invalid LTCG_X402_SOLANA_PRIVATE_KEY_B58 format (expected base58).");
  }

  if (decoded.length !== 32 && decoded.length !== 64) {
    throw new Error(
      "LTCG_X402_SOLANA_PRIVATE_KEY_B58 must decode to 32 or 64 bytes.",
    );
  }

  return decoded;
}

async function buildContext(config: X402Config): Promise<X402ClientContext> {
  if (!config.enabled) {
    throw new Error("x402 is disabled. Set LTCG_X402_ENABLED=true.");
  }
  if (!config.privateKeyBase58) {
    throw new Error("Missing LTCG_X402_SOLANA_PRIVATE_KEY_B58.");
  }

  const keyBytes = normalizePrivateKeyBytes(config.privateKeyBase58);
  const signer =
    keyBytes.length === 64
      ? await createKeyPairSignerFromBytes(keyBytes)
      : await createKeyPairSignerFromPrivateKeyBytes(keyBytes);

  const client = new x402Client();
  const signerAdapter = toClientSvmSigner(signer);
  const schemeConfig = config.rpcUrl ? { rpcUrl: config.rpcUrl } : undefined;
  const networkCaip2 = NETWORK_TO_CAIP2[config.network] as `${string}:${string}`;
  client.register(
    networkCaip2,
    new ExactSvmScheme(signerAdapter, schemeConfig),
  );
  client.registerV1(
    NETWORK_TO_V1[config.network],
    new ExactSvmSchemeV1(signerAdapter, schemeConfig),
  );

  const paidFetch = wrapFetchWithPayment(globalThis.fetch.bind(globalThis), client);
  return {
    network: config.network,
    walletAddress: signer.address,
    paidFetch,
  };
}

async function getContext(runtime: IAgentRuntime): Promise<X402ClientContext> {
  const config = readConfig(runtime);
  const fingerprint = buildFingerprint(config);

  if (cachedContextPromise && cachedFingerprint === fingerprint) {
    return cachedContextPromise;
  }

  cachedFingerprint = fingerprint;
  cachedContextPromise = buildContext(config);
  return cachedContextPromise;
}

function serializeBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) return undefined;
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body;
  if (body instanceof FormData) return body;
  if (body instanceof Blob) return body;
  if (body instanceof ArrayBuffer) return body;
  if (ArrayBuffer.isView(body)) {
    const bytes = new Uint8Array(body.byteLength);
    bytes.set(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
    return new Blob([bytes]);
  }
  return JSON.stringify(body);
}

export function sanitizeX402Error(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("LTCG_X402_")) return message;
  if (message.includes("x402 is disabled")) return message;
  if (message.includes("Invalid LTCG_X402_SOLANA_PRIVATE_KEY_B58")) return message;
  return "x402 paid request failed.";
}

export async function getX402Status(runtime: IAgentRuntime): Promise<X402Status> {
  const config = readConfig(runtime);
  const status: X402Status = {
    enabled: config.enabled,
    network: config.network,
    rpcUrlConfigured: Boolean(config.rpcUrl),
    privateKeyConfigured: Boolean(config.privateKeyBase58),
    ready: false,
    walletAddress: null,
    error: null,
  };

  if (!config.enabled) return status;
  if (!config.privateKeyBase58) {
    status.error = "Missing LTCG_X402_SOLANA_PRIVATE_KEY_B58.";
    return status;
  }

  try {
    const context = await getContext(runtime);
    status.ready = true;
    status.walletAddress = context.walletAddress;
  } catch (error) {
    status.error = sanitizeX402Error(error);
  }

  return status;
}

export async function callX402PaidEndpoint(
  runtime: IAgentRuntime,
  request: X402PaidRequest,
): Promise<X402PaidResponse> {
  const context = await getContext(runtime);
  const method = (request.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
    ...(request.headers ?? {}),
  };
  const body = serializeBody(request.body);

  if (body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(1000, Math.floor(request.timeoutMs ?? DEFAULT_TIMEOUT_MS));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await context.paidFetch(request.url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") ?? "";
    const bodyText = await response.text();
    return {
      status: response.status,
      ok: response.ok,
      contentType,
      bodyText,
      walletAddress: context.walletAddress,
      network: context.network,
    };
  } finally {
    clearTimeout(timeout);
  }
}
