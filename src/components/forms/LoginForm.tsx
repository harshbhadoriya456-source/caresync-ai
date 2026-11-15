"use client";

import { useState, useTransition } from "react";
import { signIn } from "@/app/actions";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await signIn({
        email: formData.get("email"),
        password: formData.get("password"),
      });
      if (!result.success) setError(result.message);
    });
  };

  return (
    <form action={submit} className="space-y-4">
      <label className="grid gap-1.5 text-xs font-medium text-[#476068]">
        Work email
        <input name="email" type="email" autoComplete="email" required className="min-h-11 rounded-lg border border-[#dbe5e1] bg-white px-3 text-sm text-[#203c44] outline-none focus:border-[#5b9186] focus:ring-2 focus:ring-[#5b9186]/15" />
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-[#476068]">
        Password
        <input name="password" type="password" autoComplete="current-password" required className="min-h-11 rounded-lg border border-[#dbe5e1] bg-white px-3 text-sm text-[#203c44] outline-none focus:border-[#5b9186] focus:ring-2 focus:ring-[#5b9186]/15" />
      </label>
      {error && <p role="alert" className="text-xs text-[#a8534b]">{error}</p>}
      <button type="submit" disabled={isPending} className="min-h-11 w-full rounded-lg bg-[#183e48] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#24545d] disabled:opacity-60">
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
