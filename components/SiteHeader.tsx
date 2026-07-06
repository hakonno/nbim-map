import Link from "next/link";

// Same brand block as the explore header (components/explore/ExploreApp.tsx)
// so moving between the app and the content pages feels like one site.
const NAV_LINKS = [
  { href: "/", label: "Map" },
  { href: "/properties", label: "All properties" },
] as const;

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
        <Link
          href="/"
          className="min-w-0 truncate rounded-lg font-display text-[15px] font-semibold tracking-tight text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-label="NBIM Real Estate Map — home"
        >
          NBIM Real Estate
        </Link>
        <nav aria-label="Primary">
          <ul className="flex items-center gap-1 text-sm">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-md px-2.5 py-1.5 font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
