"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Panel", icon: "🏠" },
  { href: "/program", label: "Program", icon: "📋" },
  { href: "/gunluk", label: "Günlük", icon: "📅" },
  { href: "/yemek", label: "Yemek", icon: "🍽️" },
  { href: "/olcum", label: "Ölçüm", icon: "📏" },
];

export default function BottomNav() {
  const pathname = usePathname();

  // Onboarding akışında alt menü gösterme (kullanıcının henüz profili yok).
  if (pathname.startsWith("/onboarding")) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-base/95 backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-3 text-xs ${
                active ? "text-accent" : "text-faint"
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
