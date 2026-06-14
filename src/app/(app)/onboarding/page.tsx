import OnboardingForm from "./form";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Seni tanıyalım</h1>
      <p className="text-sm text-muted">
        Sana uygun programı hazırlamak için birkaç soru soracağız. Bu uygulama
        bilgilendirme amaçlıdır; tıbbi tavsiye yerine geçmez.
      </p>
      <OnboardingForm error={error} />
    </main>
  );
}
