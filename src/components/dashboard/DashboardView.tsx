import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  HeartPulse,
  Pill,
  ShieldAlert,
  Users,
} from "lucide-react";
import { MedicationCard } from "@/components/dashboard/MedicationCard";
import { AppointmentCard } from "@/components/dashboard/AppointmentCard";
import { CareCircleList } from "@/components/dashboard/CareCircleList";
import type { ReactNode } from "react";
import type {
  Appointment,
  CareMembership,
  CareProfile,
  CareRole,
  Medication,
  MedicationEvent,
} from "@/types/database";

interface DashboardViewProps {
  careProfile: CareProfile;
  role: CareRole;
  permissions: CareMembership["permissions"];
  medications: Medication[];
  medicationEvents: MedicationEvent[];
  appointments: Appointment[];
  members: CareMembership[];
  referenceTime: number;
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en", options).format(new Date(value));
}

function ageFromDate(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

function adherencePercent(events: MedicationEvent[]): number | null {
  const completed = events.filter((event) => event.status === "taken").length;
  const resolved = events.filter((event) =>
    ["taken", "skipped", "missed"].includes(event.status)
  ).length;
  return resolved > 0 ? Math.round((completed / resolved) * 100) : null;
}

function localScheduledAt(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date.toISOString();
}

export function DashboardView({
  careProfile,
  role,
  permissions,
  medications,
  medicationEvents,
  appointments,
  members,
  referenceTime,
}: DashboardViewProps) {
  const today = new Date();
  const todayKey = today.toDateString();
  const activeMedications = medications.filter(
    (medication) =>
      medication.start_date <= today.toISOString().slice(0, 10) &&
      (!medication.end_date || medication.end_date >= today.toISOString().slice(0, 10))
  );
  const upcomingAppointments = appointments.filter(
    (appointment) => new Date(appointment.appointment_at).getTime() >= referenceTime
  );
  const patientAge = ageFromDate(careProfile.date_of_birth);
  const adherence = adherencePercent(medicationEvents);
  const canRecordMedication =
    role === "owner" ||
    role === "elderly" ||
    permissions.includes("manage_medications") ||
    permissions.includes("record_medication_events");
  const canReadHealthcare =
    role === "owner" ||
    role === "elderly" ||
    permissions.some((permission) =>
      ["read_healthcare", "manage_medications", "record_medication_events", "manage_appointments"].includes(permission)
    );
  const pendingToday = activeMedications.reduce(
    (count, medication) =>
      count +
      medication.scheduled_times.filter((time) => {
        const scheduledAt = localScheduledAt(time);
        const event = medicationEvents.find(
          (item) =>
            item.medication_id === medication.id &&
            new Date(item.scheduled_at).toDateString() === todayKey &&
            new Date(item.scheduled_at).getHours() === new Date(scheduledAt).getHours() &&
            new Date(item.scheduled_at).getMinutes() === new Date(scheduledAt).getMinutes()
        );
        return !event || event.status === "pending";
      }).length,
    0
  );
  const expiringMedications = medications.filter(
    (medication) =>
      medication.end_date && new Date(`${medication.end_date}T23:59:59`) < today
  );
  const greeting =
    role === "elderly"
      ? "Your care today"
      : role === "family"
        ? "Your family care overview"
        : "Clinical overview";

  return (
    <div className="space-y-7">
      <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d6e5df] bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#42695f]">
              <span className="size-1.5 rounded-full bg-[#639c7d]" />
              {careProfile.status === "active" ? "Active care profile" : "Closed care profile"}
            </span>
            <span className="rounded-full bg-[#e8eeed] px-2.5 py-1 text-[10px] font-medium capitalize text-[#587078]">
              {role === "caretaker" ? "Care team" : role}
            </span>
          </div>
          <h1 className="text-[clamp(1.7rem,3vw,2.4rem)] font-semibold tracking-[-0.04em] text-[#142d36]">
            {greeting}, {careProfile.display_name}
          </h1>
          <p className="mt-1.5 text-sm text-[#6b7f85]">
            {today.toLocaleDateString("en", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            {patientAge !== null && <> <span className="mx-1.5 text-[#b8c2c1]">/</span> Age {patientAge}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {careProfile.emergency_contact && (
            <div className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#e4d7d4] bg-white px-3.5 text-xs font-semibold text-[#8b4e47]">
              <ShieldAlert size={15} />
              Emergency contact · {careProfile.emergency_contact}
            </div>
          )}
          <Link
            href={`/patients/${careProfile.id}`}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#183e48] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#24545d]"
          >
            Patient profile
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {!canReadHealthcare ? (
        <section className="rounded-xl border border-[#dfe7e4] bg-white p-7 text-sm leading-relaxed text-[#61777d]">
          Your membership does not currently include access to healthcare details. Contact the care-profile owner if you need additional access.
        </section>
      ) : (
      <>
      <section aria-label="Care overview metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          icon={<Pill size={17} />}
          label="Active medications"
          value={activeMedications.length.toString()}
          detail={pendingToday ? `${pendingToday} scheduled doses still pending today` : "From this care profile"}
          tone="teal"
        />
        <MetricTile
          icon={<CalendarDays size={17} />}
          label="Upcoming visits"
          value={upcomingAppointments.length.toString()}
          detail={upcomingAppointments[0]
            ? `Next · ${formatDate(upcomingAppointments[0].appointment_at, { month: "short", day: "numeric" })}`
            : "No upcoming appointments"}
          tone="sage"
        />
        <MetricTile
          icon={<HeartPulse size={17} />}
          label="Dose adherence"
          value={adherence === null ? "—" : `${adherence}%`}
          detail={adherence === null ? "No resolved dose history yet" : "Based on recorded doses · 30 days"}
          tone={adherence !== null && adherence < 80 ? "amber" : "sage"}
        />
        <MetricTile
          icon={<Users size={17} />}
          label="Care team"
          value={members.length.toString()}
          detail="Active members on this profile"
          tone="navy"
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.9fr)]">
        <section className="overflow-hidden rounded-xl border border-[#dfe7e4] bg-white shadow-[0_8px_24px_-20px_rgba(18,44,51,.35)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9eeec] px-5 py-4 sm:px-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#769087]">Today · medication plan</p>
              <h2 className="mt-1 text-base font-semibold tracking-tight text-[#18343c]">Scheduled doses</h2>
            </div>
            <Link href="/medications" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#34776b] hover:text-[#183e48]">
              Full history <ArrowRight size={14} />
            </Link>
          </div>
          {activeMedications.length ? (
            <div className="divide-y divide-[#edf1ef]">
              {activeMedications.slice(0, 4).map((medication) => (
                <MedicationCard
                  key={medication.id}
                  medication={medication}
                  events={medicationEvents.filter((event) => event.medication_id === medication.id)}
                  canRecord={canRecordMedication}
                  dense
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No medication records"
              description="Medication information will appear here when it is added to this care profile."
              icon={<Pill size={19} />}
            />
          )}
        </section>

        <div className="space-y-5">
          <section className="rounded-xl border border-[#dfe7e4] bg-white p-5 shadow-[0_8px_24px_-20px_rgba(18,44,51,.35)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#769087]">Adherence · last 30 days</p>
                <h2 className="mt-1 text-base font-semibold text-[#18343c]">Recorded dose history</h2>
              </div>
              <span className="grid size-9 place-items-center rounded-lg bg-[#edf5f2] text-[#3d796d]">
                <HeartPulse size={17} />
              </span>
            </div>
            {adherence === null ? (
              <p className="mt-5 rounded-lg border border-dashed border-[#d7e2de] bg-[#f8faf9] px-4 py-5 text-xs leading-relaxed text-[#75878b]">
                Adherence appears after medication events have been recorded. No clinical trend is inferred from missing data.
              </p>
            ) : (
              <>
                <div className="mt-5 flex items-end justify-between">
                  <p className="text-4xl font-semibold tracking-[-0.05em] text-[#18343c]">{adherence}%</p>
                  <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-medium text-[#74888c]">
                    <ArrowDownRight size={13} />
                    {medicationEvents.length} recorded events
                  </p>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#edf1ef]" role="img" aria-label={`${adherence}% of resolved medication events were recorded as taken`}>
                  <div className="h-full rounded-full bg-[#4d897b]" style={{ width: `${adherence}%` }} />
                </div>
                <p className="mt-2 text-[10px] text-[#829195]">Taken doses / taken, skipped, and missed doses</p>
              </>
            )}
          </section>

          <section className="rounded-xl border border-[#dfe7e4] bg-white p-5 shadow-[0_8px_24px_-20px_rgba(18,44,51,.35)] sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#769087]">Next in care</p>
                <h2 className="mt-1 text-base font-semibold text-[#18343c]">Appointments</h2>
              </div>
              <Link href="/appointments" aria-label="View all appointments" className="grid size-8 place-items-center rounded-lg text-[#598178] hover:bg-[#f0f5f3]">
                <ArrowRight size={16} />
              </Link>
            </div>
            {upcomingAppointments[0] ? (
              <AppointmentCard appointment={upcomingAppointments[0]} compact referenceTime={referenceTime} />
            ) : (
              <EmptyState
                title="Nothing scheduled"
                description="Upcoming visits added to this care profile will show here."
                icon={<CalendarDays size={18} />}
              />
            )}
          </section>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)]">
        <CareCircleList members={members} />
        <section id="activity" className="rounded-xl border border-[#dfe7e4] bg-white p-5 shadow-[0_8px_24px_-20px_rgba(18,44,51,.35)] sm:p-6">
          <div className="flex items-center justify-between border-b border-[#e9eeec] pb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#769087]">Care record</p>
              <h2 className="mt-1 text-base font-semibold text-[#18343c]">Recent activity</h2>
            </div>
            <span className="text-[10px] text-[#89999c]">Latest updates</span>
          </div>
          {medicationEvents.length === 0 ? (
            <EmptyState
              title="No activity recorded"
              description="Medication event history will appear when a care-team member records a dose."
              icon={<Clock3 size={18} />}
            />
          ) : (
            <ol className="mt-2 divide-y divide-[#edf1ef]">
              {medicationEvents.slice(0, 5).map((event) => {
                const medication = medications.find((item) => item.id === event.medication_id);
                return (
                  <li key={event.id} className="flex items-start gap-3 py-3">
                    <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${
                      event.status === "taken" ? "bg-[#e9f4ed] text-[#3b7653]" :
                      event.status === "missed" ? "bg-[#fbefed] text-[#a8534b]" :
                      event.status === "pending" ? "bg-[#faf3e6] text-[#996b2c]" : "bg-[#eef1f0] text-[#64787d]"
                    }`}>
                      {event.status === "taken" ? <Check size={14} /> : <Clock3 size={14} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold capitalize text-[#29434b]">
                        {event.status} · {medication?.name ?? "Medication"}
                      </p>
                      <p className="mt-1 text-[10px] text-[#829195]">
                        Scheduled {formatDate(event.scheduled_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        {event.recorded_at && <> · Recorded {formatDate(event.recorded_at, { hour: "numeric", minute: "2-digit" })}</>}
                        {event.recorded_by && <> · Recorded by a care-team member</>}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {expiringMedications.length > 0 && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-[#ead8b9] bg-[#fffaf0] p-4 text-[#765b31]">
          <ShieldAlert size={17} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold">Medication end date passed</p>
            <p className="mt-1 text-[11px] leading-relaxed">
              {expiringMedications.map((medication) => medication.name).join(", ")} has an end date in the past. Confirm the current plan with the prescribing clinician.
            </p>
          </div>
        </div>
      )}

      <div id="support" className="flex items-center justify-between gap-3 border-t border-[#dfe7e4] pt-4 text-[10px] text-[#819195]">
        <span>Care information is shown according to your assigned access.</span>
        <span className="inline-flex items-center gap-1.5"><ShieldAlert size={12} /> Not an emergency service</span>
      </div>
      </>
      )}
    </div>
  );
}

function MetricTile({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "teal" | "sage" | "amber" | "navy";
}) {
  const iconClasses = {
    teal: "bg-[#e9f3f1] text-[#39776c]",
    sage: "bg-[#ebf4ed] text-[#4c7c59]",
    amber: "bg-[#faf2e5] text-[#9b713a]",
    navy: "bg-[#edf0f2] text-[#425d69]",
  };
  return (
    <div className="rounded-xl border border-[#dfe7e4] bg-white px-4 py-4 shadow-[0_8px_24px_-22px_rgba(18,44,51,.4)] sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium text-[#73868b]">{label}</p>
        <span className={`grid size-8 place-items-center rounded-lg ${iconClasses[tone]}`}>{icon}</span>
      </div>
      <p className="mt-3 text-[26px] font-semibold leading-none tracking-[-0.04em] text-[#18343c]">{value}</p>
      <p className="mt-2 min-h-4 text-[10px] text-[#849397]">{detail}</p>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-5 sm:px-6">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f0f5f3] text-[#61867e]">
        {icon}
      </span>
      <div>
        <p className="text-xs font-semibold text-[#405a61]">{title}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-[#849397]">{description}</p>
      </div>
    </div>
  );
}
