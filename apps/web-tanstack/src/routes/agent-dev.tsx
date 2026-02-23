import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { api } from '~/lib/convexApi'

type AgentPlatform = 'milaidy' | 'openclawd' | null
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

type StarterDeck = {
  deckCode: string
  name?: string
  archetype?: string
  description?: string
  playstyle?: string
  cardCount?: number
}

const PLATFORM_INFO = {
  milaidy: {
    name: 'Milaidy',
    tagline: 'ElizaOS-powered local agent',
    defaultApi: 'http://localhost:2138/api',
    docs: 'https://github.com/milady-ai',
  },
  openclawd: {
    name: 'OpenClawd',
    tagline: 'Sovereign AI via OpenClaw',
    defaultApi: 'http://localhost:8080/api',
    docs: 'https://openclaw.ai',
  },
} as const

const currentUserQuery = convexQuery(api.auth.currentUser, {})
const starterDecksQuery = convexQuery(api.game.getStarterDecks, {})

export const Route = createFileRoute('/agent-dev')({
  loader: async ({ context }) => {
    if (!context.convexConfigured) return
    await context.queryClient.ensureQueryData(starterDecksQuery)
  },
  component: AgentDevRoute,
})

function AgentDevRoute() {
  const { convexConfigured } = Route.useRouteContext()
  const convexSiteUrl = (import.meta.env.VITE_CONVEX_URL ?? '')
    .replace('.convex.cloud', '.convex.site')
    .replace(/\/$/, '')

  const [platform, setPlatform] = useState<AgentPlatform>(null)
  const [apiUrl, setApiUrl] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('disconnected')
  const [connMessage, setConnMessage] = useState('')

  const [agentName, setAgentName] = useState('')
  const [registering, setRegistering] = useState(false)
  const [registeredKey, setRegisteredKey] = useState<string | null>(null)
  const [registerError, setRegisterError] = useState('')
  const [copyKeyMessage, setCopyKeyMessage] = useState('')

  const [selectedDeckCode, setSelectedDeckCode] = useState('')
  const [deckMessage, setDeckMessage] = useState('')
  const [deckAssigning, setDeckAssigning] = useState(false)

  const [quickstartMessage, setQuickstartMessage] = useState('')

  const currentUser = useQuery({
    ...currentUserQuery,
    enabled: convexConfigured,
  })
  const starterDecks = useQuery({
    ...starterDecksQuery,
    enabled: convexConfigured,
  })
  const selectStarterDeck = useConvexMutation(api.game.selectStarterDeck)

  const soundtrackApiUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/api/soundtrack'
    return `${window.location.origin}/api/soundtrack`
  }, [])

  const platformInfo = platform ? PLATFORM_INFO[platform] : null

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Agent Dev</h1>
      <p className="text-sm text-stone-300">
        Register an LTCG agent key, test runtime connectivity, and assign a starter deck.
      </p>

      {!convexConfigured ? (
        <p className="text-sm text-amber-300">
          Add <code>VITE_CONVEX_URL</code> to enable registration and deck tooling.
        </p>
      ) : null}

      <article className="rounded border border-stone-700/40 p-3 text-sm">
        <h2 className="text-xs uppercase tracking-wide text-stone-400">1. Platform</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(Object.keys(PLATFORM_INFO) as Array<'milaidy' | 'openclawd'>).map((option) => (
            <button
              key={option}
              onClick={() => {
                setPlatform(option)
                setApiUrl(PLATFORM_INFO[option].defaultApi)
                setConnStatus('disconnected')
                setConnMessage('')
              }}
              className={`rounded border p-3 text-left ${
                platform === option ? 'border-cyan-700/60' : 'border-stone-700/40'
              }`}
            >
              <p className="font-semibold text-stone-100">{PLATFORM_INFO[option].name}</p>
              <p className="text-xs text-stone-400">{PLATFORM_INFO[option].tagline}</p>
            </button>
          ))}
        </div>
      </article>

      {platform ? (
        <article className="rounded border border-stone-700/40 p-3 text-sm space-y-3">
          <h2 className="text-xs uppercase tracking-wide text-stone-400">2. Register API key</h2>
          <label className="block text-xs text-stone-300">
            Agent name
            <input
              value={agentName}
              onChange={(event) => setAgentName(event.target.value)}
              className="mt-1 w-full rounded border border-stone-600 bg-stone-950 px-2 py-1 text-sm"
              placeholder={`${platformInfo?.name ?? 'Agent'} Runner`}
              maxLength={50}
            />
          </label>
          <button
            onClick={async () => {
              const trimmedName = agentName.trim()
              if (trimmedName.length < 1 || trimmedName.length > 50) {
                setRegisterError('Agent name must be 1-50 characters.')
                return
              }
              if (!convexSiteUrl) {
                setRegisterError('Convex URL missing. Configure VITE_CONVEX_URL.')
                return
              }

              setRegistering(true)
              setRegisterError('')
              setCopyKeyMessage('')
              setRegisteredKey(null)

              try {
                const response = await fetch(`${convexSiteUrl}/api/agent/register`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: trimmedName }),
                })
                const body = (await response.json()) as { error?: string; apiKey?: string }
                if (!response.ok || !body.apiKey) {
                  throw new Error(body.error ?? `Register failed (${response.status})`)
                }
                setRegisteredKey(body.apiKey)
              } catch (error) {
                setRegisterError(
                  error instanceof Error ? error.message : 'Registration failed.',
                )
              } finally {
                setRegistering(false)
              }
            }}
            disabled={registering || agentName.trim().length === 0}
            className="rounded border border-stone-600 px-3 py-1 text-xs disabled:opacity-50"
          >
            {registering ? 'Registering…' : 'Register Agent'}
          </button>
          {registerError ? <p className="text-xs text-rose-300">{registerError}</p> : null}
          {registeredKey ? (
            <div className="rounded border border-emerald-700/50 p-2 text-xs space-y-2">
              <p className="text-emerald-300">Save this key now (shown once):</p>
              <pre className="overflow-x-auto rounded bg-stone-950 p-2 text-stone-200">
                {registeredKey}
              </pre>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(registeredKey)
                    setCopyKeyMessage('API key copied.')
                  } catch {
                    setCopyKeyMessage('Clipboard unavailable.')
                  }
                }}
                className="rounded border border-stone-600 px-2 py-1"
              >
                Copy API Key
              </button>
              {copyKeyMessage ? (
                <p className="text-[11px] text-stone-300">{copyKeyMessage}</p>
              ) : null}
            </div>
          ) : null}
        </article>
      ) : null}

      {platform && registeredKey ? (
        <article className="rounded border border-stone-700/40 p-3 text-sm space-y-3">
          <h2 className="text-xs uppercase tracking-wide text-stone-400">
            3. Runtime setup + connectivity
          </h2>
          <div className="space-y-1 text-xs">
            <p className="text-stone-300">
              Docs:{' '}
              <a
                href={platformInfo?.docs}
                target="_blank"
                rel="noreferrer"
                className="underline text-cyan-300"
              >
                {platformInfo?.docs}
              </a>
            </p>
            <p className="text-stone-300">
              Soundtrack API: <code>{soundtrackApiUrl}</code>
            </p>
          </div>
          <pre className="overflow-x-auto rounded border border-stone-700/40 bg-stone-950 p-2 text-xs text-stone-200">
{`LTCG_API_KEY=${registeredKey}
LTCG_SOUNDTRACK_API_URL=${soundtrackApiUrl}`}
          </pre>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-stone-300">
              Agent API URL
              <input
                value={apiUrl}
                onChange={(event) => setApiUrl(event.target.value)}
                className="mt-1 w-full rounded border border-stone-600 bg-stone-950 px-2 py-1 text-sm"
                placeholder="http://localhost:2138/api"
              />
            </label>
            <label className="text-xs text-stone-300">
              Optional bearer token
              <input
                value={apiToken}
                onChange={(event) => setApiToken(event.target.value)}
                className="mt-1 w-full rounded border border-stone-600 bg-stone-950 px-2 py-1 text-sm"
                placeholder="token"
              />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                if (!apiUrl.trim()) {
                  setConnStatus('error')
                  setConnMessage('Agent API URL is required.')
                  return
                }
                const endpointPath = platform === 'milaidy' ? '/status' : '/health'
                const endpoint = `${apiUrl.replace(/\/$/, '')}${endpointPath}`
                const controller = new AbortController()
                const timeoutId = window.setTimeout(() => controller.abort(), 8000)

                setConnStatus('connecting')
                setConnMessage('')

                try {
                  const headers: HeadersInit = { 'Content-Type': 'application/json' }
                  if (apiToken.trim()) headers.Authorization = `Bearer ${apiToken.trim()}`
                  const response = await fetch(endpoint, {
                    headers,
                    signal: controller.signal,
                  })
                  if (!response.ok) {
                    throw new Error(`${response.status} ${response.statusText}`)
                  }
                  setConnStatus('connected')
                  setConnMessage('Agent runtime is reachable.')
                } catch (error) {
                  setConnStatus('error')
                  if (error instanceof DOMException && error.name === 'AbortError') {
                    setConnMessage('Connection timed out after 8s.')
                  } else {
                    setConnMessage(
                      error instanceof Error ? error.message : 'Connection failed.',
                    )
                  }
                } finally {
                  window.clearTimeout(timeoutId)
                }
              }}
              disabled={connStatus === 'connecting'}
              className="rounded border border-stone-600 px-3 py-1 text-xs disabled:opacity-50"
            >
              {connStatus === 'connecting' ? 'Connecting…' : 'Connect'}
            </button>
            <span
              className={`inline-flex h-2.5 w-2.5 rounded-full ${
                connStatus === 'connected'
                  ? 'bg-emerald-400'
                  : connStatus === 'connecting'
                    ? 'bg-amber-400'
                    : connStatus === 'error'
                      ? 'bg-rose-400'
                      : 'bg-stone-500'
              }`}
            />
            <span className="text-xs text-stone-300">{connMessage || connStatus}</span>
          </div>
        </article>
      ) : null}

      {registeredKey ? (
        <article className="rounded border border-stone-700/40 p-3 text-sm">
          <h2 className="text-xs uppercase tracking-wide text-stone-400">
            4. Starter deck assignment
          </h2>
          {currentUser.data == null ? (
            <p className="mt-2 text-xs text-amber-300">
              Sign in to assign your starter deck in this web app account.
            </p>
          ) : starterDecks.isLoading ? (
            <p className="mt-2 text-xs text-stone-400">Loading starter decks…</p>
          ) : starterDecks.isError ? (
            <p className="mt-2 text-xs text-rose-300">Failed to load starter decks.</p>
          ) : (
            <>
              <div className="mt-2 space-y-2">
                {((starterDecks.data ?? []) as StarterDeck[]).map((deck) => (
                  <button
                    key={deck.deckCode}
                    onClick={() => setSelectedDeckCode(deck.deckCode)}
                    className={`block w-full rounded border px-2 py-2 text-left text-xs ${
                      selectedDeckCode === deck.deckCode
                        ? 'border-cyan-700/60'
                        : 'border-stone-700/40'
                    }`}
                  >
                    <p className="font-semibold text-stone-200">{deck.name ?? deck.deckCode}</p>
                    <p className="text-stone-400">
                      {(deck.archetype ?? 'unknown').toLowerCase()} ·{' '}
                      {deck.cardCount ?? '?'} cards
                    </p>
                    {deck.playstyle ? (
                      <p className="mt-1 text-stone-500">{deck.playstyle}</p>
                    ) : null}
                  </button>
                ))}
              </div>
              <button
                onClick={async () => {
                  if (!selectedDeckCode) return
                  setDeckAssigning(true)
                  setDeckMessage('')
                  try {
                    const result = await selectStarterDeck({ deckCode: selectedDeckCode })
                    setDeckMessage(`Deck assigned: ${JSON.stringify(result)}`)
                  } catch (error) {
                    setDeckMessage(
                      error instanceof Error ? error.message : 'Deck assignment failed.',
                    )
                  } finally {
                    setDeckAssigning(false)
                  }
                }}
                disabled={!selectedDeckCode || deckAssigning}
                className="mt-3 rounded border border-stone-600 px-3 py-1 text-xs disabled:opacity-50"
              >
                {deckAssigning ? 'Assigning…' : 'Assign Starter Deck'}
              </button>
            </>
          )}
          {deckMessage ? <p className="mt-2 text-xs text-stone-300">{deckMessage}</p> : null}
        </article>
      ) : null}

      {platform ? (
        <article className="rounded border border-stone-700/40 p-3 text-sm">
          <h2 className="text-xs uppercase tracking-wide text-stone-400">Quickstart share</h2>
          <p className="mt-2 text-xs text-stone-300">
            plugin-babylon quick start:
            {' '}
            <a
              href="https://github.com/elizaos-plugins/plugin-babylon?tab=readme-ov-file#-quick-start"
              target="_blank"
              rel="noreferrer"
              className="underline text-cyan-300"
            >
              open guide
            </a>
          </p>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  'https://github.com/elizaos-plugins/plugin-babylon?tab=readme-ov-file#-quick-start',
                )
                setQuickstartMessage('Quickstart link copied.')
              } catch {
                setQuickstartMessage('Clipboard unavailable.')
              }
            }}
            className="mt-2 rounded border border-stone-600 px-3 py-1 text-xs"
          >
            Copy Quickstart Link
          </button>
          {quickstartMessage ? (
            <p className="mt-1 text-[11px] text-stone-300">{quickstartMessage}</p>
          ) : null}
        </article>
      ) : null}
    </section>
  )
}
