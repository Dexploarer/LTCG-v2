import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { getLiveStreams, getRetakeConfig, streamUrl } from '~/lib/retake'

const retakeConfig = getRetakeConfig()

const liveStreamsQuery = {
  queryKey: ['retake', 'live-streams', retakeConfig.apiUrl] as const,
  queryFn: () => getLiveStreams(retakeConfig.apiUrl),
  refetchInterval: 30_000,
}

export const Route = createFileRoute('/watch')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(liveStreamsQuery)
  },
  component: WatchRoute,
})

function WatchRoute() {
  const streams = useQuery(liveStreamsQuery)
  const primaryAgent = retakeConfig.agentName.toLowerCase()
  const list = streams.data ?? []
  const featured = list.find((s) => s.username?.toLowerCase() === primaryAgent)
  const others = list.filter((s) => s.username?.toLowerCase() !== primaryAgent)

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Watch Live</h1>
      <p className="text-sm text-stone-300">
        Live stream list from retake.tv. Refreshes every 30s.
      </p>

      {streams.isLoading ? (
        <p className="text-sm text-stone-400">Loading live streams…</p>
      ) : streams.isError ? (
        <p className="text-sm text-rose-300">Failed to load retake stream data.</p>
      ) : (
        <>
          <article className="rounded border border-stone-700/40 p-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-200">
              Featured: {retakeConfig.agentName}
            </h2>
            {featured ? (
              <div className="mt-2 text-sm">
                <p className="text-stone-300">
                  {featured.viewer_count ?? 0} watching
                </p>
                <a
                  href={streamUrl(featured.username)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-300 underline"
                >
                  Open stream
                </a>
              </div>
            ) : (
              <p className="mt-2 text-sm text-stone-400">Currently offline.</p>
            )}
          </article>

          <article className="rounded border border-stone-700/40 p-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-200">
              Other live streams ({others.length})
            </h2>
            {others.length === 0 ? (
              <p className="mt-2 text-sm text-stone-400">No other streams live.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {others.map((stream) => (
                  <li key={stream.user_id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-stone-200">{stream.username}</p>
                      <p className="text-xs text-stone-400">
                        {stream.viewer_count ?? 0} watching
                      </p>
                    </div>
                    <a
                      href={streamUrl(stream.username)}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-cyan-300 underline"
                    >
                      Watch
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </>
      )}
    </section>
  )
}
