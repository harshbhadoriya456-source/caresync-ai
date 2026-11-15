"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAppointment } from "@/app/actions";

export function AppointmentForm({ careProfileId }: { careProfileId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (formData: FormData) => {
    setError(null);
    const localDateTime = String(formData.get("appointmentAt") ?? "");
    const appointmentAt = new Date(localDateTime);
    if (!localDateTime || Number.isNaN(appointmentAt.getTime())) {
      setError("Enter a valid appointment date and time.");
      return;
    }

    startTransition(async () => {
      const result = await createAppointment({
        careProfileId,
        doctorName: formData.get("doctorName"),
        facilityName: String(formData.get("facilityName") ?? "").trim() || null,
        appointmentAt: appointmentAt.toISOString(),
        notes: String(formData.get("notes") ?? "").trim() || null,
      });
      if (!result.success) {
        setError(result.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <section className="rounded-xl border border-[#dfe7e4] bg-white shadow-[0_8px_24px_-22px_rgba(18,44,51,.4)]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-xs font-semibold text-[#34776b] hover:bg-[#f8faf9] sm:px-5"
      >
        <span>{open ? "Close appointment form" : "Schedule an appointment"}</span>
        <span aria-hidden="true" className="text-lg leading-none">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <form action={submit} className="grid gap-4 border-t border-[#e9eeec] p-4 sm:grid-cols-2 sm:p-5">
          <Field label="Clinician or provider" name="doctorName" required maxLength={160} />
          <Field label="Facility" name="facilityName" maxLength={200} />
          <Field label="Date and time" name="appointmentAt" type="datetime-local" required />
          <label className="grid gap-1.5 text-[11px] font-medium text-[#526b72] sm:col-span-2">
            Notes
            <textarea name="notes" rows={2} maxLength={2000} className="rounded-lg border border-[#dfe7e4] bg-[#fbfcfb] px-3 py-2 text-xs font-normal text-[#29434b] outline-none focus:border-[#558f84] focus:ring-2 focus:ring-[#558f84]/15" />
          </label>
          {error && <p role="alert" className="sm:col-span-2 text-xs text-[#a8534b]">{error}</p>}
          <div className="flex justify-end sm:col-span-2">
            <button type="submit" disabled={isPending} className="min-h-10 rounded-lg bg-[#183e48] px-4 text-xs font-semibold text-white transition hover:bg-[#24545d] disabled:opacity-60">
              {isPending ? "Saving…" : "Save appointment"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function Field({
  label,
  name,
  required = false,
  type = "text",
  maxLength,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  maxLength?: number;
}) {
  return (
    <label className="grid gap-1.5 text-[11px] font-medium text-[#526b72]">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        maxLength={maxLength}
        className="min-h-10 rounded-lg border border-[#dfe7e4] bg-[#fbfcfb] px-3 text-xs font-normal text-[#29434b] outline-none focus:border-[#558f84] focus:ring-2 focus:ring-[#558f84]/15"
      />
    </label>
  );
}
