import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl font-bold">ingym</h1>
      <p className="text-gray-600">Kişisel AI spor koçun ve diyetisyenin.</p>
      <Link href="/login" className="rounded bg-black px-6 py-3 font-medium text-white">
        Başla
      </Link>
    </main>
  );
}
