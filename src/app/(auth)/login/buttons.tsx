"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, signUp } from "../actions";

// Login + signup share one <form>; each button carries its own server action via
// formAction. useFormStatus().pending tells us a submit is in flight, and the
// locally tracked `clicked` tells us which button started it — so we can show a
// per-button "…yapılıyor" label and disable both while the request runs.
export default function LoginButtons() {
  const [clicked, setClicked] = useState<"signin" | "signup" | null>(null);
  const { pending } = useFormStatus();

  return (
    <>
      <button
        type="submit"
        formAction={signIn}
        onClick={() => setClicked("signin")}
        disabled={pending}
        aria-busy={pending && clicked === "signin"}
        className="rounded-lg bg-accent p-3 font-semibold text-black hover:bg-accent-hover disabled:opacity-60"
      >
        {pending && clicked === "signin" ? "Giriş yapılıyor…" : "Giriş yap"}
      </button>
      <button
        type="submit"
        formAction={signUp}
        onClick={() => setClicked("signup")}
        disabled={pending}
        aria-busy={pending && clicked === "signup"}
        className="rounded-lg border border-border p-3 font-medium text-fg hover:bg-surface disabled:opacity-60"
      >
        {pending && clicked === "signup" ? "Kayıt olunuyor…" : "Kayıt ol"}
      </button>
    </>
  );
}
