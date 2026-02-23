import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { api } from '~/lib/convexApi'

type Seat = 'host' | 'away'

type AgentMe = {
  id: string
  userId: string
  name: string
  apiKeyPrefix: string
}

type ActiveMatch = {
  matchId: string
  seat: Seat
  mode: string
  status: string
}

type SpectatorPlayer = {
  lifePoints?: number
  deckCount?: number
  handCount?: number
  graveyardCount?: number
}

type SpectatorView = {
  matchId: string
  seat: Seat
  status?: string | null
  mode?: string | null
  phase?: string
  turnNumber?: number
  players?: {
    agent?: SpectatorPlayer
    opponent?: SpectatorPlayer
  }
}

type SpectatorEvent = {
  version: number
  actor: string
  summary: string
  eventType: string
}

type StreamChatMessage = {
  _id: string
  role: 'agent' | 'viewer' | 'system'
  senderName: string
  text: string
  source: string
  createdAt: number
}

const convexSiteUrl = (import.meta.env.VITE_CONVEX_URL ?? '')
  .replace('.convex.cloud', '.convex.site')
  .replace(/\/$/, '')

function toSeat(value: unknown): Seat | undefined {
  return value === 'host' || value === 'away' ? value : undefined
}

const streamOverlaySearch = z.object({
  apiKey: z.string().optional(),
  hostId: z.string().optional(),
  matchId: z.string().optional(),
  seat: z.enum(['host', 'away']).optional(),
})

export const Route = createFileRoute('/stream-overlay')({
  validateSearch: streamOverlaySearch,
  component: StreamOverlayRoute,
})

function StreamOverlayRoute() {
  const { convexConfigured } = Route.useRouteContext()
  const search = Route.useSearch()

  const apiKey = search.apiKey?.trim()

  const agentMe = useQuery({
    queryKey: ['stream-overlay', 'agent-me', convexSiteUrl, apiKey],
    enabled: Boolean(convexConfigured && apiKey && convexSiteUrl),
    queryFn: async (): Promise<AgentMe> => {
      const res = await fetch(`${convexSiteUrl}/api/agent/me`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })
      if (!res.ok) {
        throw new Error('Invalid API key for /api/agent/me')
      }
      const data = (await res.json()) as Partial<AgentMe>
      return {
        id: String(data.id ?? ''),
        userId: String(data.userId ?? ''),
        name: String(data.name ?? 'Agent'),
        apiKeyPrefix: String(data.apiKeyPrefix ?? ''),
      }
    },
  })

  const resolvedHostId = search.hostId?.trim() || agentMe.data?.userId || ''

  const activeMatch = useQuery({
    ...convexQuery(api.game.getPublicActiveMatchByHost, { hostId: resolvedHostId }),
    enabled: convexConfigured && resolvedHostId.length > 0,
    retry: false,
  })

  const resolvedMatchId = search.matchId?.trim() || (activeMatch.data as ActiveMatch | null | undefined)?.matchId || ''
  const resolvedSeat = search.seat || toSeat((activeMatch.data as ActiveMatch | null | undefined)?.seat) || 'host'

  const spectatorView = useQuery({
    ...convexQuery(api.game.getSpectatorView, {
      matchId: resolvedMatchId,
      seat: resolvedSeat,
    }),
    enabled: convexConfigured && resolvedMatchId.length > 0,
    retry: false,
  })

  const spectatorEvents = useQuery({
    ...convexQuery(api.game.getSpectatorEventsPaginated, {
      matchId: resolvedMatchId,
      seat: resolvedSeat,
      paginationOpts: { cursor: null, numItems: 30 },
    }),
    enabled: convexConfigured && resolvedMatchId.length > 0,
    retry: false,
  })

  const chatMessages = useQuery({
    ...convexQuery(api.streamChat.getRecentStreamMessages, {
      agentId: agentMe.data?.id ?? '',
      limit: 20,
    }),
    enabled: convexConfigured && Boolean(agentMe.data?.id),
    retry: false,
  })

  const view = (spectatorView.data ?? null) as SpectatorView | null
  const events = ((spectatorEvents.data as { page?: SpectatorEvent[] } | undefined)?.page ?? []).slice(-8)
  const chat = (chatMessages.data ?? []) as StreamChatMessage[]

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Stream Overlay</h1>
      <p className="text-sm text-stone-300">
        Query-param compatible overlay route for spectator/capture migration.
      </p>

      {!convexConfigured ? (
        <p className="text-sm text-amber-300">
          Add <code>VITE_CONVEX_URL</code> to use stream overlay data.
        </p>
      ) : null}

      <article className="rounded border border-stone-700/40 p-3 text-sm">
        <h2 className="text-xs uppercase tracking-wide text-stone-400">Resolution</h2>
        <p className="mt-2 text-stone-200">
          hostId: <code>{resolvedHostId || 'missing'}</code>
        </p>
        <p className="text-stone-200">
          matchId: <code>{resolvedMatchId || 'missing'}</code>
        </p>
        <p className="text-stone-200">
          seat: <code>{resolvedSeat}</code>
        </p>
      </article>

      <article className="rounded border border-stone-700/40 p-3 text-sm">
        <h2 className="text-xs uppercase tracking-wide text-stone-400">Agent</h2>
        {apiKey ? (
          agentMe.isLoading ? (
            <p className="mt-2 text-stone-400">Loading agent via apiKey…</p>
          ) : agentMe.isError ? (
            <p className="mt-2 text-rose-300">
              {agentMe.error instanceof Error ? agentMe.error.message : 'Agent lookup failed'}
            </p>
          ) : (
            <pre className="mt-2 overflow-x-auto rounded border border-stone-700/30 p-2 text-xs text-stone-300">
              {JSON.stringify(agentMe.data, null, 2)}
            </pre>
          )
        ) : (
          <p className="mt-2 text-stone-400">
            No <code>apiKey</code> provided. Pass <code>?apiKey=ltcg_...</code> or pass <code>hostId</code> directly.
          </p>
        )}
      </article>

      <article className="rounded border border-stone-700/40 p-3 text-sm">
        <h2 className="text-xs uppercase tracking-wide text-stone-400">Active match</h2>
        {resolvedHostId.length === 0 ? (
          <p className="mt-2 text-stone-400">Resolve host first (apiKey or hostId).</p>
        ) : activeMatch.isLoading ? (
          <p className="mt-2 text-stone-400">Loading active match…</p>
        ) : activeMatch.isError ? (
          <p className="mt-2 text-rose-300">Could not load active match.</p>
        ) : !activeMatch.data ? (
          <p className="mt-2 text-stone-400">No active match for this host.</p>
        ) : (
          <pre className="mt-2 overflow-x-auto rounded border border-stone-700/30 p-2 text-xs text-stone-300">
            {JSON.stringify(activeMatch.data, null, 2)}
          </pre>
        )}
      </article>

      <article className="rounded border border-stone-700/40 p-3 text-sm">
        <h2 className="text-xs uppercase tracking-wide text-stone-400">Spectator view</h2>
        {resolvedMatchId.length === 0 ? (
          <p className="mt-2 text-stone-400">No match selected yet.</p>
        ) : spectatorView.isLoading ? (
          <p className="mt-2 text-stone-400">Loading board state…</p>
        ) : spectatorView.isError ? (
          <p className="mt-2 text-rose-300">Could not load spectator view.</p>
        ) : !view ? (
          <p className="mt-2 text-stone-400">No spectator view available.</p>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded border border-stone-700/30 p-2 text-xs">
                <p className="text-stone-400">Agent LP</p>
                <p className="text-stone-100">{view.players?.agent?.lifePoints ?? '-'}</p>
              </div>
              <div className="rounded border border-stone-700/30 p-2 text-xs">
                <p className="text-stone-400">Opponent LP</p>
                <p className="text-stone-100">{view.players?.opponent?.lifePoints ?? '-'}</p>
              </div>
            </div>
            <pre className="overflow-x-auto rounded border border-stone-700/30 p-2 text-xs text-stone-300">
              {JSON.stringify(
                {
                  phase: view.phase,
                  turnNumber: view.turnNumber,
                  status: view.status,
                  mode: view.mode,
                },
                null,
                2,
              )}
            </pre>
          </div>
        )}
      </article>

      <article className="rounded border border-stone-700/40 p-3 text-sm">
        <h2 className="text-xs uppercase tracking-wide text-stone-400">Timeline</h2>
        {resolvedMatchId.length === 0 ? (
          <p className="mt-2 text-stone-400">No match selected yet.</p>
        ) : spectatorEvents.isLoading ? (
          <p className="mt-2 text-stone-400">Loading events…</p>
        ) : spectatorEvents.isError ? (
          <p className="mt-2 text-rose-300">Could not load spectator events.</p>
        ) : events.length === 0 ? (
          <p className="mt-2 text-stone-400">No events yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-stone-300">
            {events.map((event) => (
              <li key={`${event.version}:${event.eventType}`}>
                <span className="text-stone-500">v{event.version}</span>{' '}
                <span className="text-stone-400">{event.actor}</span>{' '}
                {event.summary || event.eventType}
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="rounded border border-stone-700/40 p-3 text-sm">
        <h2 className="text-xs uppercase tracking-wide text-stone-400">Chat</h2>
        {chatMessages.isLoading ? (
          <p className="mt-2 text-stone-400">Loading stream chat…</p>
        ) : chatMessages.isError ? (
          <p className="mt-2 text-rose-300">Could not load stream chat.</p>
        ) : chat.length === 0 ? (
          <p className="mt-2 text-stone-400">No messages.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-stone-300">
            {chat.map((message) => (
              <li key={message._id}>
                <span className="text-stone-500">{message.role}</span>{' '}
                <span className="text-stone-400">{message.senderName}:</span>{' '}
                {message.text}
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  )
}
