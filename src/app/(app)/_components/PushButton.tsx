"use client";

import { useEffect, useState } from "react";
import { saveSubscription } from "./push-actions";

type Status = "idle" | "on" | "unsupported" | "working" | "denied";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function PushButton() {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => {
        if (sub) setStatus("on");
      })
      .catch(() => {});
  }, []);

  async function enable() {
    setStatus("working");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus("denied");
        return;
      }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setStatus("idle");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const json = sub.toJSON();
      const res = await saveSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
      setStatus(res.ok ? "on" : "idle");
    } catch {
      setStatus("idle");
    }
  }

  if (status === "unsupported")
    return (
      <p className="text-xs text-faint">
        Bu cihaz bildirimleri desteklemiyor. (iPhone&apos;da: Paylaş → Ana Ekrana Ekle, sonra aç.)
      </p>
    );
  if (status === "on")
    return <p className="text-sm text-accent">✓ Hatırlatıcı bildirimleri açık</p>;

  return (
    <button
      type="button"
      onClick={enable}
      disabled={status === "working"}
      className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg hover:bg-surface disabled:opacity-40"
    >
      {status === "working"
        ? "Açılıyor…"
        : status === "denied"
          ? "İzin reddedildi — tarayıcı ayarından aç"
          : "🔔 Hatırlatıcı bildirimlerini aç"}
    </button>
  );
}
