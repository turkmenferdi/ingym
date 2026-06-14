import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FoodUploader from "./uploader";

export default async function YemekPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Yemek kalori tahmini</h1>
      <p className="text-sm text-muted">
        Yemeğinin fotoğrafını çek; tahmini kalori ve makroları görelim.
      </p>
      <FoodUploader />
      <p className="text-xs text-faint">
        Değerler yapay zekâ tahminidir; porsiyona göre değişir, kesin değildir.
      </p>
    </main>
  );
}
