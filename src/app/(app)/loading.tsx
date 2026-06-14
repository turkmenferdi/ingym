export default function Loading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-6">
      <div className="h-7 w-40 animate-pulse rounded bg-surface" />
      <div className="h-24 w-full animate-pulse rounded-xl bg-surface" />
      <div className="h-24 w-full animate-pulse rounded-xl bg-surface" />
    </main>
  );
}
