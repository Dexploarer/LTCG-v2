import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/privacy')({
  component: PrivacyRoute,
})

function PrivacyRoute() {
  return (
    <article className="space-y-4">
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>
      <p className="text-xs text-stone-400">Last updated: February 2026</p>

      <section className="space-y-2 text-sm text-stone-300">
        <h2 className="font-semibold text-stone-200">1. Information We Collect</h2>
        <p>
          We collect account identity data needed for authentication and gameplay
          progression. If a wallet is connected, only the public wallet address is
          stored.
        </p>
      </section>

      <section className="space-y-2 text-sm text-stone-300">
        <h2 className="font-semibold text-stone-200">2. How We Use Data</h2>
        <p>
          Data is used to run matches, deck collections, ranked progression,
          and player profile features.
        </p>
      </section>

      <section className="space-y-2 text-sm text-stone-300">
        <h2 className="font-semibold text-stone-200">3. Third-party Services</h2>
        <p>
          LunchTable relies on external providers for auth, realtime infrastructure,
          and stream distribution. Each provider has its own policy.
        </p>
      </section>

      <section className="space-y-2 text-sm text-stone-300">
        <h2 className="font-semibold text-stone-200">4. Contact</h2>
        <p>Use the project support channels for privacy and account data requests.</p>
      </section>
    </article>
  )
}
