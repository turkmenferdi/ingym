import LoginButtons from "./buttons";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold text-accent">ingym</h1>
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
    </main>
  );
}
