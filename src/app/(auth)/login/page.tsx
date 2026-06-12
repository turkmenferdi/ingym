import { signIn, signUp } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">ingym</h1>
      {error && <p className="rounded bg-red-100 p-2 text-sm text-red-700">{error}</p>}
      <form className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          required
          placeholder="E-posta"
          className="rounded border p-3"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Şifre"
          className="rounded border p-3"
        />
        <button
          formAction={signIn}
          className="rounded bg-black p-3 font-medium text-white"
        >
          Giriş yap
        </button>
        <button
          formAction={signUp}
          className="rounded border p-3 font-medium"
        >
          Kayıt ol
        </button>
      </form>
    </main>
  );
}
