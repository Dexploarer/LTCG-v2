export type StreamOverlaySeat = "host" | "away";

export type StreamOverlayParams = {
  apiUrl: string | null;
  apiKey: string | null;
  hostId: string | null;
  matchId: string | null;
  seat: StreamOverlaySeat | null;
};

function normalizeText(value: string | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeStreamOverlaySeat(value: string | null): StreamOverlaySeat | null {
  const normalized = normalizeText(value)?.toLowerCase();
  if (!normalized) return null;
  if (normalized === "host" || normalized === "away") return normalized;
  return "host";
}

type BuildStreamOverlayParams = {
  apiUrl?: string | null;
  apiKey?: string | null;
  hostId?: string | null;
  matchId?: string | null;
  seat?: StreamOverlaySeat | string | null;
};

export function parseStreamOverlayParams(params: URLSearchParams): StreamOverlayParams {
  return {
    apiUrl: normalizeText(params.get("apiUrl")),
    apiKey: normalizeText(params.get("apiKey")),
    hostId: normalizeText(params.get("hostId")),
    matchId: normalizeText(params.get("matchId")),
    seat: normalizeStreamOverlaySeat(params.get("seat")),
  };
}

export function buildStreamOverlaySearch(params: BuildStreamOverlayParams): string {
  const search = new URLSearchParams();

  const apiUrl = normalizeText(params.apiUrl ?? null);
  const apiKey = normalizeText(params.apiKey ?? null);
  const hostId = normalizeText(params.hostId ?? null);
  const matchId = normalizeText(params.matchId ?? null);
  const seatInput = typeof params.seat === "string" ? params.seat : null;
  const seat = normalizeStreamOverlaySeat(seatInput);

  if (apiUrl) search.set("apiUrl", apiUrl);
  if (apiKey) search.set("apiKey", apiKey);
  if (hostId) search.set("hostId", hostId);
  if (matchId) search.set("matchId", matchId);
  if (seat) search.set("seat", seat);

  return search.toString();
}

export function buildStreamOverlayUrl(params: BuildStreamOverlayParams): string {
  const search = buildStreamOverlaySearch(params);
  return search.length > 0 ? `/stream-overlay?${search}` : "/stream-overlay";
}
