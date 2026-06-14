import Link from "next/link";

import { SITE_NAME } from "@/app/siteMetadata";

const NAV_LINKS = [
  { href: "/", label: "Map" },
  { href: "/properties", label: "All properties" },
] as const;

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/properties"
          className="text-sm font-semibold tracking-tight text-slate-900 hover:text-slate-700"
        >
          {SITE_NAME}
        </Link>
        <nav aria-label="Primary">
          <ul className="flex items-center gap-1 text-sm">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-md px-2.5 py-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
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
