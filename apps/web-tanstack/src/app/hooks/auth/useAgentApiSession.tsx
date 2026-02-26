import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "@/router/react-router";

export type AgentApiSession = {
  apiKey: string | null;
  agent: {
    id: string;
    userId: string;
    name: string;
    apiKeyPrefix: string;
  } | null;
  status: "disconnected" | "verifying" | "connected" | "error";
  error: string | null;
};

type AgentApiSessionContextValue = AgentApiSession & {
  apiBaseUrl: string | null;
  setApiKey: (apiKey: string | null) => void;
  clearSession: () => void;
  refresh: () => void;
};

const STORAGE_KEY = "ltcg_agent_api_key";

const DEFAULT_SESSION: AgentApiSession = {
  apiKey: null,
  agent: null,
  status: "disconnected",
  error: null,
};

const AgentApiSessionContext =
  createContext<AgentApiSessionContextValue | null>(null);

function normalizeApiKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("ltcg_")) return null;
  return trimmed;
}

function getApiBaseUrl(): string | null {
  const fromEnv = ((import.meta.env.VITE_CONVEX_URL as string | undefined) ?? "")
    .trim()
    .replace(/\/$/, "");

  if (fromEnv) {
    return fromEnv.replace(".convex.cloud", ".convex.site");
  }

  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/$/, "");
  }

  return null;
}

function parseMessageApiKey(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const msg = payload as Record<string, unknown>;
  if (msg.type !== "LTCG_AUTH") return null;
  return normalizeApiKey(msg.authToken ?? msg.apiKey ?? null);
}

export function AgentApiSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { search } = useLocation();
  const [session, setSession] = useState<AgentApiSession>(DEFAULT_SESSION);
  const [apiKeyCandidate, setApiKeyCandidate] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const verifyVersionRef = useRef(0);

  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  const setApiKey = useCallback((apiKey: string | null) => {
    const normalized = normalizeApiKey(apiKey);
    if (!normalized) {
      setApiKeyCandidate(null);
      return;
    }
    setApiKeyCandidate(normalized);
  }, []);

  const clearSession = useCallback(() => {
    setApiKeyCandidate(null);
    setSession(DEFAULT_SESSION);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore localStorage failures so auth never hard-fails.
      }
    }
  }, []);

  const refresh = useCallback(() => {
    setRefreshNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = normalizeApiKey(window.localStorage.getItem(STORAGE_KEY));
    if (stored) {
      setApiKeyCandidate(stored);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams((search ?? "").replace(/^\?/, ""));
    const fromQuery = normalizeApiKey(params.get("apiKey"));
    if (fromQuery) {
      setApiKeyCandidate(fromQuery);
    }
  }, [search]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onMessage = (event: MessageEvent) => {
      const key = parseMessageApiKey(event.data);
      if (key) {
        setApiKeyCandidate(key);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!apiBaseUrl || !apiKeyCandidate) {
      setSession((prev) => {
        if (prev.status === "error" && prev.error) return prev;
        return DEFAULT_SESSION;
      });
      return;
    }

    let cancelled = false;
    const verifyVersion = ++verifyVersionRef.current;

    setSession({
      apiKey: apiKeyCandidate,
      agent: null,
      status: "verifying",
      error: null,
    });

    (async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/agent/me`, {
          headers: {
            Authorization: `Bearer ${apiKeyCandidate}`,
            "Content-Type": "application/json",
          },
        });

        if (cancelled || verifyVersion !== verifyVersionRef.current) return;

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          const reason =
            typeof payload?.error === "string"
              ? payload.error
              : "Invalid or expired agent API key.";

          setSession({
            apiKey: null,
            agent: null,
            status: "error",
            error: reason,
          });
          setApiKeyCandidate(null);
          if (typeof window !== "undefined") {
            try {
              window.localStorage.removeItem(STORAGE_KEY);
            } catch {
              // Ignore localStorage failures.
            }
          }
          return;
        }

        const me = (await response.json()) as Record<string, unknown>;
        const nextSession: AgentApiSession = {
          apiKey: apiKeyCandidate,
          agent: {
            id: String(me.id ?? ""),
            userId: String(me.userId ?? ""),
            name: String(me.name ?? "Agent"),
            apiKeyPrefix: String(me.apiKeyPrefix ?? ""),
          },
          status: "connected",
          error: null,
        };

        setSession(nextSession);
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(STORAGE_KEY, apiKeyCandidate);
          } catch {
            // Ignore localStorage failures.
          }
        }
      } catch (error) {
        if (cancelled || verifyVersion !== verifyVersionRef.current) return;
        const message =
          error instanceof Error ? error.message : "Failed to verify agent API key.";
        setSession({
          apiKey: null,
          agent: null,
          status: "error",
          error: message,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, apiKeyCandidate, refreshNonce]);

  const value = useMemo<AgentApiSessionContextValue>(
    () => ({
      ...session,
      apiBaseUrl,
      setApiKey,
      clearSession,
      refresh,
    }),
    [apiBaseUrl, clearSession, refresh, session, setApiKey],
  );

  return (
    <AgentApiSessionContext.Provider value={value}>
      {children}
    </AgentApiSessionContext.Provider>
  );
}

export function useAgentApiSession(): AgentApiSessionContextValue {
  const context = useContext(AgentApiSessionContext);
  if (!context) {
    throw new Error("useAgentApiSession must be used inside AgentApiSessionProvider.");
  }
  return context;
}
