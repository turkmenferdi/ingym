import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col justify-center gap-6 p-8 md:p-16 lg:p-24">
      <h1 className="text-5xl font-bold text-accent md:text-7xl lg:text-8xl">ingym</h1>
      <p className="max-w-xl text-lg text-muted md:text-2xl">
        Kişisel AI spor koçun ve diyetisyenin.
      </p>
      <Link
        href="/login"
        className="w-fit rounded-lg bg-accent px-8 py-3.5 text-lg font-semibold text-black hover:bg-accent-hover"
      >
        Başla
      </Link>
    </main>
  );
}
