"use client";

import { useState, useTransition } from "react";
import { signUp } from "@/app/actions";

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (formData: FormData) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await signUp({
        email: formData.get("email"),
        password: formData.get("password"),
      });
      if (!result.success) {
        setError(result.message);
        return;
      }
      setNotice(result.message);
    });
  };

  return (
    <form action={submit} className="space-y-4">
      <label className="grid gap-1.5 text-xs font-medium text-[#476068]">
        Email address
        <input name="email" type="email" autoComplete="email" required className="min-h-11 rounded-lg border border-[#dbe5e1] bg-white px-3 text-sm text-[#203c44] outline-none focus:border-[#5b9186] focus:ring-2 focus:ring-[#5b9186]/15" />
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-[#476068]">
        Password
        <input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required className="min-h-11 rounded-lg border border-[#dbe5e1] bg-white px-3 text-sm text-[#203c44] outline-none focus:border-[#5b9186] focus:ring-2 focus:ring-[#5b9186]/15" />
      </label>
      {error && <p role="alert" className="text-xs leading-relaxed text-[#a8534b]">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-[#d8e6e1] bg-[#f4f8f6] p-3 text-xs leading-relaxed text-[#356d5c]">{notice}</p>}
      <button type="submit" disabled={isPending} className="min-h-11 w-full rounded-lg bg-[#183e48] px-4 text-sm font-semibold text-white transition hover:bg-[#24545d] disabled:opacity-60">
        {isPending ? "Creating account…" : "Create account"}
      </button>
      <p className="text-[10px] leading-relaxed text-[#89999c]">An account alone does not grant access to patient records. You must redeem a valid care-profile invitation.</p>
    </form>
  );
}
