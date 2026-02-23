import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '~/lib/convexApi'

type LobbySummary = {
  matchId: string
  hostUserId: string
  hostUsername: string
  visibility: 'public' | 'private'
  joinCode: string | null
  status: 'waiting' | 'active' | 'ended' | 'canceled'
  createdAt: number
  activatedAt: number | null
  endedAt: number | null
  pongEnabled: boolean
  redemptionEnabled: boolean
}

const currentUserQuery = convexQuery(api.auth.currentUser, {})
const myLobbyQuery = convexQuery(api.game.getMyPvpLobby, {})
const openLobbiesQuery = convexQuery(api.game.listOpenPvpLobbies, {})

export const Route = createFileRoute('/pvp')({
  loader: async ({ context }) => {
    if (!context.convexConfigured) return
    await context.queryClient.ensureQueryData(currentUserQuery)
  },
  component: PvpRoute,
})

function PvpRoute() {
  const { convexConfigured } = Route.useRouteContext()
  const navigate = Route.useNavigate()

  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [pongEnabled, setPongEnabled] = useState(false)
  const [redemptionEnabled, setRedemptionEnabled] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const currentUser = useQuery({
    ...currentUserQuery,
    enabled: convexConfigured,
  })
  const myLobby = useQuery({
    ...myLobbyQuery,
    enabled: convexConfigured && currentUser.data != null,
    retry: false,
  })
  const openLobbies = useQuery({
    ...openLobbiesQuery,
    enabled: convexConfigured && currentUser.data != null,
    retry: false,
  })

  const createLobby = useConvexMutation(api.game.createPvpLobby)
  const joinLobby = useConvexMutation(api.game.joinPvpLobby)
  const joinByCode = useConvexMutation(api.game.joinPvpLobbyByCode)
  const cancelLobby = useConvexMutation(api.game.cancelPvpLobby)

  const canCreateLobby = !myLobby.data || (myLobby.data as LobbySummary).status !== 'waiting'

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">PvP Lobby</h1>

      {!convexConfigured ? (
        <p className="text-sm text-amber-300">
          Add <code>VITE_CONVEX_URL</code> to use PvP lobbies.
        </p>
      ) : currentUser.data == null ? (
        <p className="text-sm text-amber-300">Sign in to create or join lobbies.</p>
      ) : (
        <>
          <article className="rounded border border-stone-700/40 p-3 text-sm">
            <h2 className="text-xs uppercase tracking-wide text-stone-400">Create lobby</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  setBusy('create-public')
                  setMessage('')
                  try {
                    const result = (await createLobby({
                      visibility: 'public',
                      pongEnabled,
                      redemptionEnabled,
                    })) as { matchId: string }
                    setMessage(`Public lobby created: ${result.matchId}`)
                    await Promise.all([myLobby.refetch(), openLobbies.refetch()])
                  } catch (err) {
                    setMessage(err instanceof Error ? err.message : 'Create failed')
                  } finally {
                    setBusy(null)
                  }
                }}
                disabled={busy != null || !canCreateLobby}
                className="rounded border border-stone-600 px-3 py-1 text-xs disabled:opacity-50"
              >
                Create Public
              </button>
              <button
                onClick={async () => {
                  setBusy('create-private')
                  setMessage('')
                  try {
                    const result = (await createLobby({
                      visibility: 'private',
                      pongEnabled,
                      redemptionEnabled,
                    })) as { matchId: string; joinCode?: string | null }
                    setMessage(
                      `Private lobby created: ${result.matchId}${
                        result.joinCode ? ` (code ${result.joinCode})` : ''
                      }`,
                    )
                    await Promise.all([myLobby.refetch(), openLobbies.refetch()])
                  } catch (err) {
                    setMessage(err instanceof Error ? err.message : 'Create failed')
                  } finally {
                    setBusy(null)
                  }
                }}
                disabled={busy != null || !canCreateLobby}
                className="rounded border border-stone-600 px-3 py-1 text-xs disabled:opacity-50"
              >
                Create Private
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={pongEnabled}
                  onChange={(e) => setPongEnabled(e.target.checked)}
                />
                Beer Pong
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={redemptionEnabled}
                  onChange={(e) => setRedemptionEnabled(e.target.checked)}
                />
                Redemption
              </label>
            </div>
            {!canCreateLobby ? (
              <p className="mt-2 text-xs text-stone-400">
                You already have a waiting lobby.
              </p>
            ) : null}
          </article>

          <article className="rounded border border-stone-700/40 p-3 text-sm">
            <h2 className="text-xs uppercase tracking-wide text-stone-400">Join by code</h2>
            <div className="mt-2 flex gap-2">
              <input
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                className="w-full rounded border border-stone-600 bg-stone-950 px-2 py-1 text-xs tracking-widest"
                placeholder="ABC123"
                maxLength={6}
              />
              <button
                onClick={async () => {
                  setBusy('join-code')
                  setMessage('')
                  try {
                    const result = (await joinByCode({
                      joinCode: joinCodeInput.trim().toUpperCase(),
                    })) as { matchId: string }
                    setMessage(`Joined ${result.matchId}`)
                    navigate({ to: '/play/$matchId', params: { matchId: result.matchId } })
                  } catch (err) {
                    setMessage(err instanceof Error ? err.message : 'Join failed')
                  } finally {
                    setBusy(null)
                  }
                }}
                disabled={busy != null || joinCodeInput.trim().length !== 6}
                className="rounded border border-stone-600 px-3 py-1 text-xs disabled:opacity-50"
              >
                Join
              </button>
            </div>
          </article>

          <article className="rounded border border-stone-700/40 p-3 text-sm">
            <h2 className="text-xs uppercase tracking-wide text-stone-400">My lobby</h2>
            {myLobby.isLoading ? (
              <p className="mt-2 text-stone-400">Loading…</p>
            ) : myLobby.isError ? (
              <p className="mt-2 text-rose-300">Failed to load your lobby.</p>
            ) : !myLobby.data ? (
              <p className="mt-2 text-stone-400">No active or waiting lobby.</p>
            ) : (
              <div className="mt-2 space-y-2">
                <pre className="overflow-x-auto rounded border border-stone-700/30 p-2 text-xs text-stone-300">
                  {JSON.stringify(myLobby.data, null, 2)}
                </pre>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const matchId = (myLobby.data as LobbySummary).matchId
                      navigate({ to: '/play/$matchId', params: { matchId } })
                    }}
                    className="rounded border border-stone-600 px-2 py-1 text-xs"
                  >
                    Open Match
                  </button>
                  {(myLobby.data as LobbySummary).status === 'waiting' ? (
                    <button
                      onClick={async () => {
                        setBusy('cancel-lobby')
                        setMessage('')
                        try {
                          await cancelLobby({ matchId: (myLobby.data as LobbySummary).matchId })
                          setMessage('Lobby canceled.')
                          await Promise.all([myLobby.refetch(), openLobbies.refetch()])
                        } catch (err) {
                          setMessage(err instanceof Error ? err.message : 'Cancel failed')
                        } finally {
                          setBusy(null)
                        }
                      }}
                      disabled={busy != null}
                      className="rounded border border-stone-600 px-2 py-1 text-xs disabled:opacity-50"
                    >
                      Cancel Lobby
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </article>

          <article className="rounded border border-stone-700/40 p-3 text-sm">
            <h2 className="text-xs uppercase tracking-wide text-stone-400">
              Open public lobbies
            </h2>
            {openLobbies.isLoading ? (
              <p className="mt-2 text-stone-400">Loading lobbies…</p>
            ) : openLobbies.isError ? (
              <p className="mt-2 text-rose-300">Failed to load public lobbies.</p>
            ) : ((openLobbies.data as LobbySummary[] | undefined) ?? []).length === 0 ? (
              <p className="mt-2 text-stone-400">No public lobbies available.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {((openLobbies.data as LobbySummary[]) ?? []).map((lobby) => (
                  <div
                    key={lobby.matchId}
                    className="flex items-center justify-between rounded border border-stone-700/30 px-2 py-1 text-xs"
                  >
                    <div>
                      <p className="text-stone-200">
                        {lobby.hostUsername} · {lobby.visibility}
                      </p>
                      <p className="text-stone-400">{lobby.matchId}</p>
                    </div>
                    <button
                      onClick={async () => {
                        setBusy(`join:${lobby.matchId}`)
                        setMessage('')
                        try {
                          const result = (await joinLobby({ matchId: lobby.matchId })) as {
                            matchId: string
                          }
                          navigate({ to: '/play/$matchId', params: { matchId: result.matchId } })
                        } catch (err) {
                          setMessage(err instanceof Error ? err.message : 'Join failed')
                        } finally {
                          setBusy(null)
                        }
                      }}
                      disabled={busy != null}
                      className="rounded border border-stone-600 px-2 py-1 text-xs disabled:opacity-50"
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
          </article>
        </>
      )}

      {message ? <p className="text-sm text-stone-300">{message}</p> : null}
    </section>
  )
}
