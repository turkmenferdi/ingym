"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function Icon({ name, className }: { name: string; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };
  switch (name) {
    case "panel":
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </svg>
      );
    case "program":
      return (
        <svg {...common}>
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4V3h6v1" />
          <path d="M9 10h6M9 14h6M9 18h4" />
        </svg>
      );
    case "gunluk":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      );
    case "yemek":
      return (
        <svg {...common}>
          <path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11" />
          <path d="M16 3c-1.6 0-2.5 2.2-2.5 5s1 3.8 2.5 3.8V21" />
        </svg>
      );
    case "olcum":
      return (
        <svg {...common}>
          <rect x="3" y="8" width="18" height="8" rx="1" />
          <path d="M7 8v3M11 8v4M15 8v3M19 8v4" />
        </svg>
      );
    default:
      return null;
  }
}

const TABS = [
  { href: "/dashboard", label: "Panel", icon: "panel" },
  { href: "/program", label: "Program", icon: "program" },
  { href: "/gunluk", label: "Günlük", icon: "gunluk" },
  { href: "/yemek", label: "Yemek", icon: "yemek" },
  { href: "/olcum", label: "Ölçüm", icon: "olcum" },
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
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] ${
                active ? "text-accent" : "text-faint"
              }`}
            >
              <Icon name={tab.icon} className="h-5 w-5" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
