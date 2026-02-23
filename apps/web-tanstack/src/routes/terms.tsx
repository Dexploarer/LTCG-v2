import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/terms')({
  component: TermsRoute,
})

function TermsRoute() {
  return (
    <article className="space-y-4">
      <h1 className="text-2xl font-semibold">Terms of Service</h1>
      <p className="text-xs text-stone-400">Last updated: February 2026</p>

      <section className="space-y-2 text-sm text-stone-300">
        <h2 className="font-semibold text-stone-200">1. Acceptance</h2>
        <p>
          By using LunchTable you agree to these terms. If you do not agree, do not
          use the service.
        </p>
      </section>

      <section className="space-y-2 text-sm text-stone-300">
        <h2 className="font-semibold text-stone-200">2. Accounts and Conduct</h2>
        <p>
          Users are responsible for account security and must not exploit gameplay,
          harass players, or manipulate competitive systems.
        </p>
      </section>

      <section className="space-y-2 text-sm text-stone-300">
        <h2 className="font-semibold text-stone-200">3. Gameplay and Balancing</h2>
        <p>
          Card mechanics, ranked systems, and digital game assets may be changed as
          part of live balancing and feature updates.
        </p>
      </section>

      <section className="space-y-2 text-sm text-stone-300">
        <h2 className="font-semibold text-stone-200">4. Liability</h2>
        <p>
          The service is provided as-is. Availability and data continuity are not
          guaranteed.
        </p>
      </section>
    </article>
  )
}
