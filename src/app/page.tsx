import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl font-bold text-accent">ingym</h1>
      <p className="text-muted">Kişisel AI spor koçun ve diyetisyenin.</p>
      <Link href="/login" className="rounded-lg bg-accent px-6 py-3 font-semibold text-black hover:bg-accent-hover">
        Başla
      </Link>
    </main>
  );
}
