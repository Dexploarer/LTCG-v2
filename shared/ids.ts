const RESERVED_IDS = new Set(["undefined", "null", "skip"]);

const normalizeOptionalId = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (RESERVED_IDS.has(trimmed.toLowerCase())) return null;
  return trimmed;
};

export const normalizeDeckId = (deckId?: string | null): string | null =>
  normalizeOptionalId(deckId);

export const normalizeMatchId = (matchId?: string | null): string | null =>
  normalizeOptionalId(matchId);
