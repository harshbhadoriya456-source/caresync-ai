"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revokeCareMembership, updateMemberPermissions } from "@/app/actions";
import type { CareMembership, CarePermission } from "@/types/database";

const availablePermissions: { value: CarePermission; label: string }[] = [
  { value: "read_healthcare", label: "Read healthcare information" },
  { value: "record_medication_events", label: "Record medication events" },
  { value: "manage_medications", label: "Manage medication records" },
  { value: "manage_appointments", label: "Manage appointments" },
];

export function CareMemberEditor({ member }: { member: CareMembership }) {
  const router = useRouter();
  const [selected, setSelected] = useState<CarePermission[]>(member.permissions ?? []);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await updateMemberPermissions({
        membershipId: member.id,
        permissions: selected,
      });
      if (!result.success) {
        setError(result.message);
        return;
      }
      setNotice("Access settings updated.");
      router.refresh();
    });
  };

  const revoke = () => {
    if (!window.confirm("Remove this member's access to the care profile?")) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await revokeCareMembership({ membershipId: member.id });
      if (!result.success) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="border-t border-[#edf1ef] px-4 py-4 sm:px-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#819195]">Granted access</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {availablePermissions.map((permission) => (
          <label key={permission.value} className="flex items-start gap-2 text-[11px] leading-relaxed text-[#536b72]">
            <input
              type="checkbox"
              checked={selected.includes(permission.value)}
              disabled={isPending}
              onChange={(event) =>
                setSelected((current) =>
                  event.target.checked
                    ? [...current, permission.value]
                    : current.filter((value) => value !== permission.value)
                )
              }
              className="mt-0.5 accent-[#39776c]"
            />
            {permission.label}
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button type="button" disabled={isPending} onClick={save} className="min-h-8 rounded-md bg-[#e7f2ee] px-3 text-[10px] font-semibold text-[#356d5c] hover:bg-[#d9eae3] disabled:opacity-50">
          Save permissions
        </button>
        <button type="button" disabled={isPending} onClick={revoke} className="min-h-8 rounded-md px-3 text-[10px] font-medium text-[#a8534b] hover:bg-[#fbefed] disabled:opacity-50">
          Remove access
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-[10px] text-[#a8534b]">{error}</p>}
      {notice && <p role="status" className="mt-2 text-[10px] text-[#3b7653]">{notice}</p>}
    </div>
  );
}
