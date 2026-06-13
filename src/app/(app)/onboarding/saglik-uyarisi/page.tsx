import Link from "next/link";

export default function SaglikUyarisiPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Önce sağlığın 🩺</h1>
      <p className="text-gray-700">
        Verdiğin bilgilere göre, yoğun bir spor veya diyet programına başlamadan
        önce bir sağlık profesyoneline danışmanı öneririz. Profilin kaydedildi;
        program önerilerimiz bu durumu dikkate alacak ve temkinli olacak.
      </p>
      <p className="text-sm text-gray-500">
        ingym bilgilendirme amaçlıdır; tıbbi tavsiye, teşhis veya tedavi yerine geçmez.
      </p>
      <Link href="/dashboard"
        className="rounded bg-black px-6 py-3 text-center font-medium text-white">
        Panele git
      </Link>
    </main>
  );
}
