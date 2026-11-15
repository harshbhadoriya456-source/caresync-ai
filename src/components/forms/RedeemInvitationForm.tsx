"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { redeemCareInvitation } from "@/app/actions";

export function RedeemInvitationForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await redeemCareInvitation({ code });
      if (!result.success) {
        setError(result.message);
        return;
      }
      setCode("");
      router.replace("/dashboard");
      router.refresh();
    });
  };

  return (
    <form action={submit} className="space-y-4">
      <label className="grid gap-1.5 text-xs font-medium text-[#476068]">
        Invitation code
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          type="password"
          autoComplete="off"
          spellCheck={false}
          required
          maxLength={256}
          className="min-h-11 rounded-lg border border-[#dbe5e1] bg-white px-3 font-mono text-sm text-[#203c44] outline-none focus:border-[#5b9186] focus:ring-2 focus:ring-[#5b9186]/15"
        />
      </label>
      {error && <p role="alert" className="text-xs leading-relaxed text-[#a8534b]">{error}</p>}
      <button type="submit" disabled={isPending || !code.trim()} className="min-h-11 w-full rounded-lg bg-[#183e48] px-4 text-sm font-semibold text-white transition hover:bg-[#24545d] disabled:opacity-60">
        {isPending ? "Verifying invitation…" : "Redeem invitation"}
      </button>
      <p className="text-[10px] leading-relaxed text-[#89999c]">The code is sent directly to the secured database redemption function and is not saved by this page.</p>
    </form>
  );
}
