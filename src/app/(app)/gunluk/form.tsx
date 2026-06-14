"use client";

import { useState } from "react";
import { saveDailyLog } from "./actions";

const inputCls = "rounded-lg border border-border bg-surface p-3 text-fg placeholder:text-faint";
const labelCls = "flex flex-col gap-1 text-sm font-medium";

export default function DailyForm({
  initial,
}: {
  initial: { trained: boolean; weightKg: string; notes: string };
}) {
  const [trained, setTrained] = useState(initial.trained);
  const [saving, setSaving] = useState(false);

  return (
    <form
      action={async (fd) => {
        setSaving(true);
        await saveDailyLog(fd);
      }}
      className="flex flex-col gap-3"
    >
      <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
        <input type="checkbox" name="trained" checked={trained}
          onChange={(e) => setTrained(e.target.checked)} />
        Bugün antrenman yaptım
      </label>
      <label className={labelCls}>
        Kilo (kg) — opsiyonel
        <input className={inputCls} name="weightKg" type="number" inputMode="decimal"
          step="0.1" defaultValue={initial.weightKg} placeholder="örn. 72.5" />
      </label>
      <label className={labelCls}>
        Bugün ne yedin / nasıl geçti?
        <textarea className={inputCls} name="notes" rows={4}
          defaultValue={initial.notes} placeholder="Öğünler, notlar…" />
      </label>
      <button disabled={saving}
        className="rounded-lg bg-accent p-3 font-semibold text-black hover:bg-accent-hover disabled:opacity-40">
        {saving ? "Kaydediliyor…" : "Günü kaydet ve geri bildirim al"}
      </button>
    </form>
  );
}
