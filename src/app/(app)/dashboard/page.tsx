import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../../(auth)/actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Merhaba 👋</h1>
      <p className="text-gray-600">{user.email}</p>
      <p className="text-sm text-gray-500">
        Burası boş gösterge paneli. Onboarding ve program özellikleri sonraki planlarda gelecek.
      </p>
      <form action={signOut}>
        <button className="rounded border p-3 font-medium">Çıkış yap</button>
      </form>
    </main>
  );
}
