import { signIn, signUp } from "../actions";

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
        <input
          name="email"
          type="email"
          required
          placeholder="E-posta"
          className="rounded-lg border border-border bg-surface p-3 text-fg placeholder:text-faint"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Şifre"
          className="rounded-lg border border-border bg-surface p-3 text-fg placeholder:text-faint"
        />
        <button
          formAction={signIn}
          className="rounded-lg bg-accent p-3 font-semibold text-black hover:bg-accent-hover"
        >
          Giriş yap
        </button>
        <button
          formAction={signUp}
          className="rounded-lg border border-border p-3 font-medium text-fg hover:bg-surface"
        >
          Kayıt ol
        </button>
      </form>
    </main>
  );
}
