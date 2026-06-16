import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col justify-center gap-6 p-8 md:p-16 lg:p-24">
      <h1 className="sr-only">ingym</h1>
      <Image
        src="/logo.png"
        alt="ingym — Fitness & Performance"
        width={1200}
        height={654}
        priority
        sizes="(min-width: 768px) 28rem, 100vw"
        className="h-auto w-full max-w-md rounded-2xl"
      />
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
