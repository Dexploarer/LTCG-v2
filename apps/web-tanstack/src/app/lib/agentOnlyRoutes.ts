const AGENT_ONLY_BLOCKED_PREFIXES = [
  "/onboarding",
  "/profile",
  "/settings",
  "/collection",
  "/decks",
  "/cliques",
  "/duel",
  "/cards",
  "/discord-callback",
  "/leaderboard",
  "/story",
  "/pvp",
  "/play",
];

const AGENT_ONLY_ALLOWED_EXACT = new Set([
  "/",
  "/watch",
  "/stream-overlay",
  "/about",
  "/privacy",
  "/terms",
  "/token",
  "/agent-lobby",
]);

export function shouldRedirectToAgentLobby(pathname: string): boolean {
  if (!pathname) return false;
  if (AGENT_ONLY_ALLOWED_EXACT.has(pathname)) return false;
  return AGENT_ONLY_BLOCKED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
