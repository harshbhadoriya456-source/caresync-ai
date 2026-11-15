"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock3, LoaderCircle, ShieldAlert } from "lucide-react";
import { recordMedicationEvent } from "@/app/actions";
import type { Medication, MedicationEvent, MedicationEventStatus } from "@/types/database";

interface MedicationCardProps {
  medication: Medication;
  events: MedicationEvent[];
  canRecord: boolean;
  dense?: boolean;
}

const statusStyles: Record<MedicationEventStatus, string> = {
  pending: "bg-[#faf3e6] text-[#8e682f]",
  taken: "bg-[#e9f4ed] text-[#3b7653]",
  skipped: "bg-[#eef1f0] text-[#64787d]",
  missed: "bg-[#fbefed] text-[#a8534b]",
  unconfirmed: "bg-[#faf3e6] text-[#8e682f]",
};

function scheduledAtToday(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date.toISOString();
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" });
}

export function MedicationCard({
  medication,
  events,
  canRecord,
  dense = false,
}: MedicationCardProps) {
  const router = useRouter();
  const [pendingTime, setPendingTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const recordStatus = async (time: string, status: "taken" | "skipped") => {
    if (pendingTime) return;
    const scheduledAt = scheduledAtToday(time);
    const existing = events.find(
      (event) => Math.abs(new Date(event.scheduled_at).getTime() - new Date(scheduledAt).getTime()) < 60_000
    );
    if (existing && existing.status !== "pending") {
      setError("This scheduled dose has already been recorded.");
      return;
    }
    if (!window.confirm(`Record this dose as ${status}? This cannot be undone.`)) return;

    setPendingTime(time);
    setError(null);
    setMessage(null);
    const result = await recordMedicationEvent({
      medicationId: medication.id,
      scheduledAt,
      status,
    });
    setPendingTime(null);
    if (!result.success) {
      setError(result.message);
      return;
    }
    setMessage(`Dose recorded as ${status}.`);
    router.refresh();
  };

  const todayKey = new Date().toDateString();

  return (
    <article className={`px-5 sm:px-6 ${dense ? "py-4" : "py-5"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-sm font-semibold text-[#213d45]">{medication.name}</h3>
            <span className="text-[11px] font-medium text-[#587078]">{medication.dosage}</span>
          </div>
          <p className="mt-1 text-[11px] text-[#7b8d91]">
            {medication.frequency}
            {medication.instructions && <span> · {medication.instructions}</span>}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#f0f4f2] px-2.5 py-1 text-[10px] font-medium text-[#647a7f]">
          {medication.scheduled_times.length} scheduled {medication.scheduled_times.length === 1 ? "time" : "times"}/day
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {medication.scheduled_times.map((time) => {
          const scheduledAt = scheduledAtToday(time);
          const event = events.find(
            (item) =>
              new Date(item.scheduled_at).toDateString() === todayKey &&
              Math.abs(new Date(item.scheduled_at).getTime() - new Date(scheduledAt).getTime()) < 60_000
          );
          const status = event?.status ?? "pending";
          const isBusy = pendingTime === time;
          return (
            <li
              key={time}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-[#edf1ef] bg-[#fafcfb] px-3 py-2"
            >
              <span className="inline-flex min-w-[84px] items-center gap-1.5 text-[11px] font-medium text-[#526b72]">
                <Clock3 size={13} className="text-[#82969a]" />
                {formatTime(time)}
              </span>
              <span className={`rounded-full px-2 py-1 text-[9px] font-semibold capitalize ${statusStyles[status]}`}>
                {status}
              </span>
              {event?.recorded_at && (
                <span className="text-[9px] text-[#839397]">
                  at {new Date(event.recorded_at).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" })}
                </span>
              )}
              {event?.recorded_by && (
                <span className="text-[9px] text-[#839397]">· recorded by care team</span>
              )}
              {canRecord && (!event || event.status === "pending") && (
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={Boolean(pendingTime)}
                    onClick={() => recordStatus(time, "taken")}
                    className="inline-flex min-h-8 items-center gap-1 rounded-md bg-[#e7f2ee] px-2.5 text-[10px] font-semibold text-[#356d5c] transition hover:bg-[#d9eae3] disabled:opacity-50"
                  >
                    {isBusy ? <LoaderCircle size={12} className="animate-spin" /> : <Check size={12} />}
                    Taken
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(pendingTime)}
                    onClick={() => recordStatus(time, "skipped")}
                    className="min-h-8 rounded-md border border-[#dfe7e4] px-2.5 text-[10px] font-medium text-[#718389] transition hover:bg-[#f1f4f3] disabled:opacity-50"
                  >
                    Skip
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="mt-2 inline-flex items-center gap-1.5 text-[10px] text-[#a8534b]"><ShieldAlert size={12} />{error}</p>}
      {message && <p role="status" className="mt-2 text-[10px] text-[#3b7653]">{message}</p>}
    </article>
  );
}
