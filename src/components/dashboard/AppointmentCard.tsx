import { CalendarDays, Clock3, MapPin, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { Appointment } from "@/types/database";

interface AppointmentCardProps {
  appointment: Appointment;
  compact?: boolean;
  referenceTime: number;
}

export function AppointmentCard({ appointment, compact = false, referenceTime }: AppointmentCardProps) {
  const date = new Date(appointment.appointment_at);
  const isUpcoming = date.getTime() >= referenceTime;
  const formattedDate = date.toLocaleDateString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: compact ? undefined : "numeric",
  });
  const formattedTime = date.toLocaleTimeString("en", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (compact) {
    return (
      <article className="mt-4 rounded-lg border border-[#e5ece9] bg-[#f8faf9] p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Badge variant={isUpcoming ? "teal" : "neutral"} size="sm">
              {isUpcoming ? "Upcoming" : "Past visit"}
            </Badge>
            <h3 className="mt-2 truncate text-sm font-semibold text-[#29434b]">{appointment.doctor_name}</h3>
            {appointment.facility_name && <p className="mt-1 truncate text-[11px] text-[#788b8f]">{appointment.facility_name}</p>}
          </div>
          <div className="shrink-0 rounded-md bg-white px-2.5 py-2 text-right">
            <p className="text-[10px] font-semibold uppercase text-[#47796e]">{formattedDate}</p>
            <p className="mt-0.5 text-[11px] font-medium text-[#526b72]">{formattedTime}</p>
          </div>
        </div>
        {appointment.notes && <p className="mt-3 border-t border-[#e6ece9] pt-2.5 text-[10px] leading-relaxed text-[#788b8f]">{appointment.notes}</p>}
      </article>
    );
  }

  return (
    <article className="flex flex-col justify-between gap-4 rounded-lg border border-[#e5ece9] bg-white p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 space-y-2">
        <Badge variant={isUpcoming ? "teal" : "neutral"} size="sm">
          {isUpcoming ? "Upcoming visit" : "Past visit"}
        </Badge>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[#29434b]">
          <UserRound size={15} className="shrink-0 text-[#598178]" />
          {appointment.doctor_name}
        </h3>
        {appointment.facility_name && (
          <p className="flex items-center gap-1.5 text-[11px] text-[#788b8f]"><MapPin size={13} />{appointment.facility_name}</p>
        )}
        {appointment.notes && <p className="max-w-2xl text-[11px] leading-relaxed text-[#788b8f]">{appointment.notes}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3 rounded-lg bg-[#f4f8f6] px-3 py-2 text-[#47796e]">
        <CalendarDays size={16} />
        <div>
          <p className="text-[10px] font-semibold">{formattedDate}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[#6d8584]"><Clock3 size={11} />{formattedTime}</p>
        </div>
      </div>
    </article>
  );
}
