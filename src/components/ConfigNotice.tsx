export default function ConfigNotice() {
  return (
    <section className="mx-auto mt-6 max-w-xl rounded-xl2 border border-blush bg-surface p-7 text-center shadow-soft">
      <h2 className="font-serif text-2xl text-charcoal">Almost ready</h2>
      <p className="mt-3 text-sm leading-relaxed text-warm-gray">
        This gallery isn&apos;t connected to Supabase yet. Add your environment
        variables and reload:
      </p>
      <ul className="mx-auto mt-4 w-fit space-y-1 text-left text-sm text-charcoal">
        <li>
          <code className="rounded bg-cream px-1.5 py-0.5">
            NEXT_PUBLIC_SUPABASE_URL
          </code>
        </li>
        <li>
          <code className="rounded bg-cream px-1.5 py-0.5">
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </code>
        </li>
      </ul>
      <p className="mt-4 text-xs text-warm-gray">
        See <code className="rounded bg-cream px-1 py-0.5">README.md</code> for
        the full setup steps.
      </p>
    </section>
  );
}
