"use client";

import { useState, useTransition } from "react";
import { createCareInvitation } from "@/app/actions";

export function InviteForm({ careProfileId }: { careProfileId: string }) {
  const [role, setRole] = useState<"family" | "caretaker">("family");
  const [invitation, setInvitation] = useState<{ code: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const issueInvitation = () => {
    setError(null);
    setInvitation(null);
    setCopied(false);
    startTransition(async () => {
      const result = await createCareInvitation({ careProfileId, role });
      if (!result.success) {
        setError(result.message);
        return;
      }
      setInvitation({ code: result.code, expiresAt: result.expiresAt });
    });
  };

  return (
    <section className="rounded-xl border border-[#dfe7e4] bg-white p-5 shadow-[0_8px_24px_-22px_rgba(18,44,51,.4)] sm:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#769087]">Owner action</p>
      <h2 className="mt-1 text-base font-semibold text-[#18343c]">Invite a care-team member</h2>
      <p className="mt-2 text-[11px] leading-relaxed text-[#788b8f]">
        The invitation is single-use and expires after 72 hours. Its code is shown only in this response; do not save it in shared notes or browser storage.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="grid flex-1 gap-1.5 text-[11px] font-medium text-[#526b72]">
          Intended role
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as "family" | "caretaker")}
            disabled={Boolean(invitation) || isPending}
            className="min-h-10 rounded-lg border border-[#dfe7e4] bg-[#fbfcfb] px-3 text-xs text-[#29434b]"
          >
            <option value="family">Family — choose specific read access</option>
            <option value="caretaker">Caretaker — choose specific care permissions</option>
          </select>
        </label>
        {!invitation && (
          <button
            type="button"
            disabled={isPending}
            onClick={issueInvitation}
            className="min-h-10 self-end rounded-lg bg-[#183e48] px-4 text-xs font-semibold text-white transition hover:bg-[#24545d] disabled:opacity-60"
          >
            {isPending ? "Creating…" : "Create invitation"}
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-[#a8534b]">{error}</p>}
      {invitation && (
        <div className="mt-4 rounded-lg border border-[#d8e6e1] bg-[#f4f8f6] p-4">
          <p role="status" className="text-xs font-semibold text-[#356d5c]">Invitation ready · expires {new Date(invitation.expiresAt).toLocaleString()}</p>
          <p className="mt-2 break-all rounded-md border border-[#dfe7e4] bg-white px-3 py-2 font-mono text-xs text-[#29434b]">{invitation.code}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(invitation.code);
                  setCopied(true);
                } catch {
                  setError("Clipboard access failed. Select and copy the code manually.");
                }
              }}
              className="min-h-9 rounded-md border border-[#cfded9] bg-white px-3 text-[11px] font-semibold text-[#42695f] hover:bg-[#f8faf9]"
            >
              {copied ? "Copied" : "Copy code"}
            </button>
            <button
              type="button"
              onClick={() => setInvitation(null)}
              className="min-h-9 rounded-md px-3 text-[11px] font-medium text-[#718389] hover:bg-white"
            >
              Hide code
            </button>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-[#829195]">Copy this code only to the intended recipient using a secure channel. It will not be available again after you leave this page.</p>
        </div>
      )}
    </section>
  );
}
