import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { todayInTR } from "@/lib/daily/today";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  webpush.setVapidDetails(
    "mailto:ferdi.turkmen@gmail.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const today = todayInTR();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth");
  const { data: logs } = await admin
    .from("daily_logs")
    .select("user_id")
    .eq("log_date", today);
  const loggedUsers = new Set((logs ?? []).map((l) => l.user_id));

  let sent = 0;
  let removed = 0;
  for (const s of subs ?? []) {
    if (loggedUsers.has(s.user_id)) continue;
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: "ingym", body: "Bugünü loglamayı unutma 💪", url: "/gunluk" })
      );
      sent++;
    } catch (e: unknown) {
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        await admin.from("push_subscriptions").delete().eq("id", s.id);
        removed++;
      }
    }
  }

  return NextResponse.json({ sent, removed });
}
