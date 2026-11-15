"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMedication } from "@/app/actions";

export function MedicationForm({ careProfileId }: { careProfileId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (formData: FormData) => {
    setError(null);
    const timeValues = String(formData.get("scheduledTimes") ?? "")
      .split(",")
      .map((time) => time.trim())
      .filter(Boolean);
    const endDate = String(formData.get("endDate") ?? "").trim();
    startTransition(async () => {
      const result = await createMedication({
        careProfileId,
        name: formData.get("name"),
        dosage: formData.get("dosage"),
        frequency: formData.get("frequency"),
        instructions: String(formData.get("instructions") ?? "").trim() || null,
        scheduledTimes: timeValues,
        startDate: formData.get("startDate"),
        endDate: endDate || null,
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
        <span>{open ? "Close medication entry" : "Add medication to the recorded plan"}</span>
        <span aria-hidden="true" className="text-lg leading-none">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <form action={submit} className="grid gap-4 border-t border-[#e9eeec] p-4 sm:grid-cols-2 sm:p-5">
          <div className="sm:col-span-2 rounded-lg border border-[#e8dcbf] bg-[#fffaf0] p-3 text-[11px] leading-relaxed text-[#775d34]">
            Enter details from the current clinician-provided plan. This form does not recommend or change prescriptions.
          </div>
          <Field label="Medication name" name="name" required maxLength={160} />
          <Field label="Dose as written" name="dosage" required maxLength={120} />
          <Field label="Frequency" name="frequency" required maxLength={120} placeholder="As documented in the plan" />
          <Field label="Scheduled times" name="scheduledTimes" required placeholder="08:00, 20:00" hint="Use 24-hour time, separated by commas." />
          <Field label="Start date" name="startDate" type="date" required />
          <Field label="End date (optional)" name="endDate" type="date" />
          <label className="grid gap-1.5 text-[11px] font-medium text-[#526b72] sm:col-span-2">
            Instructions
            <textarea name="instructions" rows={2} maxLength={1000} className="rounded-lg border border-[#dfe7e4] bg-[#fbfcfb] px-3 py-2 text-xs font-normal text-[#29434b] outline-none focus:border-[#558f84] focus:ring-2 focus:ring-[#558f84]/15" />
          </label>
          {error && <p role="alert" className="sm:col-span-2 text-xs text-[#a8534b]">{error}</p>}
          <div className="flex justify-end sm:col-span-2">
            <button type="submit" disabled={isPending} className="min-h-10 rounded-lg bg-[#183e48] px-4 text-xs font-semibold text-white transition hover:bg-[#24545d] disabled:opacity-60">
              {isPending ? "Saving…" : "Save medication record"}
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
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  maxLength?: number;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="grid gap-1.5 text-[11px] font-medium text-[#526b72]">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        className="min-h-10 rounded-lg border border-[#dfe7e4] bg-[#fbfcfb] px-3 text-xs font-normal text-[#29434b] outline-none focus:border-[#558f84] focus:ring-2 focus:ring-[#558f84]/15"
      />
      {hint && <span className="text-[10px] font-normal text-[#839397]">{hint}</span>}
    </label>
  );
}
