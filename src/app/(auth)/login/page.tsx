import Image from "next/image";
import LoginButtons from "./buttons";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-dvh md:grid-cols-2">
      {/* Masaüstünde sol marka paneli; mobilde gizli (form panelindeki başlık yeter). */}
      <section className="hidden flex-col justify-center gap-6 border-r border-border p-16 md:flex">
        <h1 className="sr-only">ingym</h1>
        <Image
          src="/logo.png"
          alt="ingym — Fitness & Performance"
          width={1200}
          height={654}
          priority
          sizes="28rem"
          className="h-auto w-full max-w-md rounded-2xl"
        />
        <p className="max-w-md text-xl text-muted">
          Kişisel AI spor koçun ve diyetisyenin.
        </p>
      </section>

      {/* Form paneli — masaüstünde ekranın sağ yarısını doldurur, mobilde tek kolon. */}
      <section className="flex flex-col justify-center p-6 md:p-16">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-4 md:mx-0">
          <h1 className="text-2xl font-bold text-accent md:hidden">ingym</h1>
          {error && <p className="rounded-lg border border-red-900 bg-red-950 p-3 text-sm text-red-300">{error}</p>}
          <form className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-xs text-faint">
          E-posta
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            aria-label="E-posta"
            placeholder="ornek@eposta.com"
            className="rounded-lg border border-border bg-surface p-3 text-base text-fg placeholder:text-faint"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-faint">
          Şifre
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            aria-label="Şifre"
            className="rounded-lg border border-border bg-surface p-3 text-base text-fg placeholder:text-faint"
          />
        </label>
        <LoginButtons />
      </form>
        </div>
      </section>
    </main>
  );
}
