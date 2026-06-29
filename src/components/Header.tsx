import { SITE } from "@/lib/site";

export default function Header() {
  return (
    <header className="pt-12 pb-8 text-center sm:pt-16">
      <p className="text-[0.7rem] uppercase tracking-[0.32em] text-warm-gray">
        {SITE.kicker}
      </p>

      <h1 className="mt-4 font-serif text-5xl font-medium leading-tight text-charcoal sm:text-6xl">
        {SITE.coupleNames}
      </h1>

      {SITE.date ? (
        <p className="mt-3 font-serif text-lg italic text-rose-deep">
          {SITE.date}
        </p>
      ) : null}

      {/* Hairline divider with a small sage diamond */}
      <div className="mx-auto mt-6 flex w-40 items-center justify-center gap-3">
        <span className="h-px flex-1 bg-rose/40" />
        <span className="h-1.5 w-1.5 rotate-45 rounded-[1px] bg-sage" />
        <span className="h-px flex-1 bg-rose/40" />
      </div>

      <p className="mx-auto mt-5 max-w-md text-pretty text-[0.95rem] leading-relaxed text-warm-gray">
        {SITE.tagline}
      </p>
    </header>
  );
}
