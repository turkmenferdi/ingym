"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";

// Masaüstünde sol kenar çubuğu (w-60) için içeriği sağa kaydır; mobilde alt
// çubuk için altta boşluk bırak. Onboarding akışında menü yok, içerik tam genişlik.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/onboarding")) return <>{children}</>;

  return (
    <div className="pb-20 md:pb-0 md:pl-60">
      {children}
      <BottomNav />
    </div>
  );
}
