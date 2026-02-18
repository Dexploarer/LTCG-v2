import { useEffect, useMemo, useState } from "react";
import {
  useAgentSpectator,
  type PublicEventLogEntry,
  type PublicSpectatorSlot,
  type PublicSpectatorView,
} from "@/hooks/useAgentSpectator";
import type { IframeChatState } from "@/hooks/useIframeMode";
import type { IframeChatMessage } from "@/lib/iframe";

interface Props {
  apiKey: string;
  apiUrl: string;
  agentId?: string | null;
  hostChatState?: IframeChatState | null;
  hostChatEvent?: IframeChatMessage | null;
  onSendChat?: (text: string, matchId?: string) => void;
}

const RETAKE_EMBED_BASE = (import.meta.env.VITE_RETAKE_EMBED_BASE_URL as string | undefined) ??
  "https://retake.tv/embed";
const RETAKE_CHANNEL_BASE = (import.meta.env.VITE_RETAKE_CHANNEL_BASE_URL as string | undefined) ??
  "https://retake.tv";

export function AgentSpectatorView({
  apiKey,
  apiUrl,
  agentId,
  hostChatState,
  hostChatEvent,
  onSendChat,
}: Props) {
  const { agent, matchState, timeline, error, loading } = useAgentSpectator(apiKey, apiUrl);
  const [chatMessages, setChatMessages] = useState<IframeChatMessage[]>([]);
  const [draft, setDraft] = useState("");

  const isIframeHost = typeof window !== "undefined" && window.self !== window.top;
  const chatEnabled = hostChatState?.enabled !== false;
  const chatReadOnly = !isIframeHost || hostChatState?.readOnly === true || !onSendChat || !chatEnabled;

  useEffect(() => {
    if (!hostChatState?.messages) return;
    setChatMessages(hostChatState.messages);
  }, [hostChatState?.messages]);

  useEffect(() => {
    if (!hostChatEvent) return;
    setChatMessages((current) => {
      if (current.some((entry) => entry.id === hostChatEvent.id)) return current;
      return [...current, hostChatEvent];
    });
  }, [hostChatEvent]);

  const streamEmbedUrl = useMemo(() => {
    if (!agent?.name) return null;
    return `${RETAKE_EMBED_BASE.replace(/\/$/, "")}/${encodeURIComponent(agent.name)}`;
  }, [agent?.name]);

  const streamPageUrl = useMemo(() => {
    if (!agent?.name) return RETAKE_CHANNEL_BASE;
    return `${RETAKE_CHANNEL_BASE.replace(/\/$/, "")}/${encodeURIComponent(agent.name)}`;
  }, [agent?.name]);

  const sendMessage = () => {
    const text = draft.trim();
    if (!text || chatReadOnly || !onSendChat) return;

    onSendChat(text, matchState?.matchId);
    setChatMessages((current) => [
      ...current,
      {
        id: `local-${Date.now()}`,
        role: "user",
        text,
        createdAt: Date.now(),
      },
    ]);
    setDraft("");
  };

  if (loading) return <SpectatorLoading />;
  if (error) return <SpectatorError message={error} />;
  if (!agent) return <SpectatorError message="Could not connect to agent" />;

  return (
    <div className="min-h-screen bg-[#fdfdfb] text-[#121212]">
      <header className="border-b-2 border-[#121212] px-4 py-3 flex items-center justify-between bg-white/90">
        <div>
          <p className="text-[10px] text-[#999] uppercase tracking-wider">Embedded Broadcast</p>
          <h1 className="text-lg leading-tight" style={{ fontFamily: "Outfit, sans-serif", fontWeight: 900 }}>
            {agent.name}
          </h1>
          <p className="text-[10px] text-[#666] font-mono">{agent.apiKeyPrefix}</p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 uppercase tracking-wider"
          style={{ fontFamily: "Outfit, sans-serif" }}
        >
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          Live
        </span>
      </header>

      <main className="p-3 md:p-4 grid grid-cols-1 xl:grid-cols-3 gap-3">
        <section className="paper-panel p-3 col-span-1 xl:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-wider text-[#666]">Stream</p>
            <a
              href={streamPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] uppercase tracking-wider font-bold text-[#121212]/70 hover:text-[#121212]"
            >
              Open Channel
            </a>
          </div>
          {streamEmbedUrl ? (
            <iframe
              src={streamEmbedUrl}
              title={`${agent.name} stream`}
              className="w-full aspect-video border-2 border-[#121212]"
              allow="autoplay; fullscreen"
            />
          ) : (
            <div className="w-full aspect-video border-2 border-[#121212] flex items-center justify-center text-xs text-[#666]">
              Stream unavailable
            </div>
          )}
        </section>

        <section className="paper-panel p-3 col-span-1">
          <p className="text-[11px] uppercase tracking-wider text-[#666] mb-2">Chat</p>
          <div className="border border-[#121212]/30 h-56 overflow-auto bg-white/70 p-2 space-y-2">
            {chatMessages.length === 0 ? (
              <p className="text-[11px] text-[#666] italic">No host chat messages yet.</p>
            ) : (
              chatMessages.map((entry) => (
                <div key={entry.id} className="text-[11px]">
                  <p className="font-bold uppercase tracking-wide text-[10px] text-[#666]">
                    {entry.role}
                  </p>
                  <p className="leading-snug">{entry.text}</p>
                </div>
              ))
            )}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") sendMessage();
              }}
              disabled={chatReadOnly}
              placeholder={chatReadOnly ? "Host chat bridge required" : "Send message to host chat"}
              className="flex-1 border-2 border-[#121212] bg-white px-2 py-1 text-xs disabled:opacity-60"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={chatReadOnly || draft.trim().length === 0}
              className="tcg-button px-3 py-1 text-[10px] disabled:opacity-60"
            >
              Send
            </button>
          </div>
          {chatReadOnly && (
            <p className="text-[10px] text-[#666] mt-2">
              {hostChatState?.reason ??
                (chatEnabled
                  ? "Chat is read-only until the host bridge is connected."
                  : "Host disabled chat for this stream.")}
            </p>
          )}
          {!agentId && (
            <p className="text-[10px] text-[#666] mt-1">
              Agent relay id not provided by host.
            </p>
          )}
        </section>

        <section className="paper-panel p-3 col-span-1 xl:col-span-2">
          <p className="text-[11px] uppercase tracking-wider text-[#666] mb-2">Public Game Board</p>
          {matchState ? (
            <PublicBoard state={matchState} />
          ) : (
            <p className="text-xs text-[#666]">Waiting for an active match...</p>
          )}
        </section>

        <section className="paper-panel p-3 col-span-1">
          <p className="text-[11px] uppercase tracking-wider text-[#666] mb-2">Action Timeline</p>
          <Timeline entries={timeline} />
        </section>
      </main>
    </div>
  );
}

function PublicBoard({ state }: { state: PublicSpectatorView }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        <Stat label="Phase" value={state.phase} />
        <Stat label="Turn" value={String(state.turnNumber)} />
        <Stat label="Agent Turn" value={state.isAgentTurn ? "Yes" : "No"} />
        <Stat label="Status" value={state.status ?? "unknown"} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="border border-[#121212]/30 bg-white/70 p-2">
          <p className="font-bold mb-1">Agent</p>
          <p>LP: {state.players.agent.lifePoints}</p>
          <p>Hand: {state.players.agent.handCount}</p>
          <p>Deck: {state.players.agent.deckCount}</p>
          <p>GY/BAN: {state.players.agent.graveyardCount}/{state.players.agent.banishedCount}</p>
        </div>
        <div className="border border-[#121212]/30 bg-white/70 p-2">
          <p className="font-bold mb-1">Opponent</p>
          <p>LP: {state.players.opponent.lifePoints}</p>
          <p>Hand: {state.players.opponent.handCount}</p>
          <p>Deck: {state.players.opponent.deckCount}</p>
          <p>GY/BAN: {state.players.opponent.graveyardCount}/{state.players.opponent.banishedCount}</p>
        </div>
      </div>

      <FieldPanel label="Opponent Monsters" slots={state.fields.opponent.monsters} />
      <FieldPanel label="Opponent Backrow" slots={state.fields.opponent.spellTraps} />
      <FieldPanel label="Agent Monsters" slots={state.fields.agent.monsters} />
      <FieldPanel label="Agent Backrow" slots={state.fields.agent.spellTraps} />
    </div>
  );
}

function FieldPanel({ label, slots }: { label: string; slots: PublicSpectatorSlot[] }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[#666] mb-1">{label}</p>
      <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5">
        {slots.map((slot) => (
          <div key={`${label}-${slot.lane}`} className="border border-[#121212]/30 bg-white/70 p-1.5 min-h-14">
            {!slot.occupied ? (
              <p className="text-[10px] text-[#aaa]">Empty</p>
            ) : slot.faceDown ? (
              <p className="text-[10px] text-[#666]">Face-down</p>
            ) : (
              <>
                <p className="text-[10px] font-bold leading-tight line-clamp-2">{slot.name ?? "Card"}</p>
                {slot.attack !== null && slot.defense !== null && (
                  <p className="text-[9px] text-[#666] mt-0.5">
                    {slot.attack}/{slot.defense}
                  </p>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Timeline({ entries }: { entries: PublicEventLogEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-xs text-[#666]">No events yet.</p>;
  }

  return (
    <div className="max-h-[420px] overflow-auto space-y-2">
      {entries.slice().reverse().map((entry) => (
        <div key={`${entry.version}-${entry.eventType}-${entry.createdAt ?? 0}`} className="border border-[#121212]/20 bg-white/70 p-2">
          <p className="text-[10px] uppercase tracking-wider text-[#666]">
            {entry.actor} · v{entry.version}
          </p>
          <p className="text-xs font-bold mt-0.5">{entry.summary}</p>
          <p className="text-[11px] text-[#666] mt-1">{entry.rationale}</p>
        </div>
      ))}
    </div>
  );
}

function SpectatorLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fdfdfb]">
      <div className="w-8 h-8 border-4 border-[#121212] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function SpectatorError({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fdfdfb]">
      <div className="text-center">
        <p className="text-sm font-bold text-red-600 mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>
          Connection Failed
        </p>
        <p className="text-xs text-[#666]" style={{ fontFamily: "Special Elite, cursive" }}>
          {message}
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-1 border border-[#121212]/30 bg-white/70">
      <p className="text-[9px] uppercase tracking-wider text-[#777]">{label}</p>
      <p className="text-xs font-bold">{value}</p>
    </div>
  );
}
