"use client";

import Image from "next/image";
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
    case "antrenman":
      return (
        <svg {...common}>
          <path d="m6.5 6.5 11 11" />
          <path d="m21 21-1-1" />
          <path d="m3 3 1 1" />
          <path d="m18 22 4-4" />
          <path d="m2 6 4-4" />
          <path d="m3 10 7-7" />
          <path d="m14 21 7-7" />
        </svg>
      );
    case "diyet":
      return (
        <svg {...common}>
          <path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z" />
          <path d="M10 2c1 .5 2 2 2 5" />
        </svg>
      );
    case "gunluk":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
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
  { href: "/antrenman", label: "Antrenman", icon: "antrenman" },
  { href: "/diyet", label: "Diyet", icon: "diyet" },
  { href: "/gunluk", label: "Günlük", icon: "gunluk" },
  { href: "/olcum", label: "Ölçüm", icon: "olcum" },
];

export default function BottomNav() {
  const pathname = usePathname();

  // Onboarding akışında menü gösterme (kullanıcının henüz profili yok).
  if (pathname.startsWith("/onboarding")) return null;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Masaüstü: sol kenar çubuğu */}
      <aside className="fixed left-0 top-0 z-10 hidden h-dvh w-60 flex-col border-r border-border bg-base/95 p-4 backdrop-blur md:flex">
        <span className="flex items-center gap-2 px-3 py-2 text-lg font-bold text-accent">
          <Image src="/mark.png" alt="" width={512} height={512} className="h-7 w-7 rounded-md" />
          ingym
        </span>
        <nav className="mt-2 flex flex-col gap-1">
          {TABS.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                  active ? "bg-surface text-accent" : "text-faint hover:bg-surface hover:text-fg"
                }`}
              >
                <Icon name={tab.icon} className="h-5 w-5" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobil: alt çubuk */}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-base/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md">
          {TABS.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
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
    </>
  );
}
