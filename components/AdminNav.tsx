"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/admin/services", label: "Services", icon: "🧰" },
  { href: "/admin/availability", label: "Availability", icon: "⏱" },
  { href: "/admin/appointments", label: "Appointments", icon: "📅" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-30 bg-white/95 border-b border-slate-200">
      <div className="card p-2 sm:p-3">
        <div className="flex items-center gap-2">
          {links.map((l) => {
            const isActive = pathname?.startsWith(l.href);

            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium transition",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-400",
                  isActive
                    ? "bg-ink-700 text-white ring-1 ring-ink-700"
                    : "text-slate-700 hover:bg-slate-100",
                ].join(" ")}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {l.icon}
                </span>

                {/* Hide labels on mobile */}
                <span className="hidden sm:inline">{l.label}</span>
              </Link>
            );
          })}

          <Link
            href="/"
            className="ml-auto flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
          >
            <span className="text-lg" aria-hidden>
              🌐
            </span>
            <span className="hidden sm:inline">Public Site</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
