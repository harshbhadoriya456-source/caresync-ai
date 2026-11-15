import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { ReactNode } from "react";
import { CalendarDays, Clock3, HeartPulse, ShieldAlert, Users } from "lucide-react";
import { AppointmentCard } from "@/components/dashboard/AppointmentCard";
import { CareCircleList } from "@/components/dashboard/CareCircleList";
import { MedicationCard } from "@/components/dashboard/MedicationCard";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { WorkspaceLoading } from "@/components/layout/WorkspaceLoading";
import { loadCareWorkspace } from "@/lib/data/workspace";

interface PatientPageProps {
  params: Promise<{ id: string }>;
}

export default function PatientPage({ params }: PatientPageProps) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <PatientContent params={params} />
    </Suspense>
  );
}

async function PatientContent({ params }: PatientPageProps) {
  const { id } = await params;
  const workspace = await loadCareWorkspace(id);
  const { careProfile, activeMembership } = workspace;
  if (!careProfile || !activeMembership) notFound();

  const canRead =
    activeMembership.role === "owner" ||
    activeMembership.role === "elderly" ||
    activeMembership.permissions.some((permission) =>
      ["read_healthcare", "manage_medications", "record_medication_events", "manage_appointments"].includes(permission)
    );
  if (!canRead) {
    return (
      <WorkspaceShell
        userEmail={workspace.user.email}
        role={activeMembership.role}
        permissions={activeMembership.permissions}
        careProfiles={[]}
        selectedCareProfileId={null}
      >
        <section className="rounded-xl border border-[#dfe7e4] bg-white p-6 text-sm leading-relaxed text-[#61777d]">
          Your membership does not currently include access to this care profile.
        </section>
      </WorkspaceShell>
    );
  }
  const canRecord =
    activeMembership.role === "owner" ||
    activeMembership.role === "elderly" ||
    activeMembership.permissions.includes("record_medication_events") ||
    activeMembership.permissions.includes("manage_medications");
  const age = careProfile.date_of_birth ? calculateAge(careProfile.date_of_birth) : null;
  const referenceTime = new Date(workspace.referenceTime).getTime();
  const upcoming = workspace.appointments.filter((item) => new Date(item.appointment_at).getTime() >= referenceTime);
  const recentEvents = workspace.medicationEvents.slice(0, 6);

  return (
    <WorkspaceShell
      userEmail={workspace.user.email}
      role={activeMembership.role}
      permissions={activeMembership.permissions}
      careProfiles={workspace.careProfiles}
      selectedCareProfileId={careProfile.id}
    >
      <div className="space-y-6">
        <header className="rounded-xl border border-[#dfe7e4] bg-white p-5 shadow-[0_8px_24px_-20px_rgba(18,44,51,.35)] sm:p-7">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#eaf3f0] text-[#4c8175]"><Users size={21} /></span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-[#18343c]">{careProfile.display_name}</h1>
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${careProfile.status === "active" ? "bg-[#e9f4ed] text-[#3b7653]" : "bg-[#eef1f0] text-[#64787d]"}`}>{careProfile.status}</span>
                </div>
                <p className="mt-1.5 text-xs text-[#73868b]">
                  {age === null ? "Date of birth not recorded" : `Age ${age}`}
                  {careProfile.date_of_birth && <> · Date of birth {new Date(`${careProfile.date_of_birth}T00:00:00`).toLocaleDateString()}</>}
                </p>
                <p className="mt-1 text-[10px] text-[#89999c]">Your relationship: <span className="capitalize">{activeMembership.role}</span></p>
              </div>
            </div>
            {careProfile.emergency_contact && (
              <div className="rounded-lg border border-[#ead8d4] bg-[#fffafa] px-3 py-2.5">
                <p className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-[#9b5b54]"><ShieldAlert size={12} /> Emergency contact</p>
                <p className="mt-1 text-xs font-medium text-[#594341]">{careProfile.emergency_contact}</p>
              </div>
            )}
          </div>
        </header>

            <>
            <section className="grid gap-3 sm:grid-cols-3">
              <ProfileStat icon={<HeartPulse size={16} />} label="Medication records" value={workspace.medications.length} />
              <ProfileStat icon={<CalendarDays size={16} />} label="Upcoming visits" value={upcoming.length} />
              <ProfileStat icon={<Users size={16} />} label="Care team members" value={workspace.memberships.length} />
            </section>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,.8fr)]">
              <section className="overflow-hidden rounded-xl border border-[#dfe7e4] bg-white">
                <SectionHeading eyebrow="Today’s plan" title="Medication schedule" icon={<HeartPulse size={16} />} />
                {workspace.medications.length ? (
                  <div className="divide-y divide-[#edf1ef]">
                    {workspace.medications.map((medication) => (
                      <MedicationCard
                        key={medication.id}
                        medication={medication}
                        events={workspace.medicationEvents.filter((event) => event.medication_id === medication.id)}
                        canRecord={canRecord}
                      />
                    ))}
                  </div>
                ) : <EmptyState title="No medication records" description="Medication records will appear when available for this care profile." />}
              </section>
              <div className="space-y-5">
                <section className="rounded-xl border border-[#dfe7e4] bg-white p-5">
                  <SectionHeading eyebrow="Upcoming" title="Appointments" icon={<CalendarDays size={16} />} />
                  {upcoming[0] ? <AppointmentCard appointment={upcoming[0]} compact referenceTime={referenceTime} /> : <EmptyState title="No upcoming visits" description="Scheduled appointments will be listed here." />}
                </section>
                <section className="rounded-xl border border-[#dfe7e4] bg-white p-5">
                  <SectionHeading eyebrow="Coordination" title="Care plan & tasks" icon={<Clock3 size={16} />} />
                  <p className="mt-4 rounded-lg border border-dashed border-[#d7e2de] bg-[#f8faf9] p-4 text-[11px] leading-relaxed text-[#788b8f]">
                    Care plans and task lists are not represented in the connected application data yet. No tasks are being inferred or displayed.
                  </p>
                </section>
              </div>
            </div>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <CareCircleList members={workspace.memberships} />
              <section className="rounded-xl border border-[#dfe7e4] bg-white p-5 sm:p-6">
                <SectionHeading eyebrow="Audit trail" title="Recent medication activity" icon={<Clock3 size={16} />} />
                {recentEvents.length ? (
                  <ol className="mt-2 divide-y divide-[#edf1ef]">
                    {recentEvents.map((event) => {
                      const medication = workspace.medications.find((item) => item.id === event.medication_id);
                      return (
                        <li key={event.id} className="py-3">
                          <p className="text-xs font-semibold capitalize text-[#405a61]">{event.status} · {medication?.name ?? "Medication"}</p>
                          <p className="mt-1 text-[10px] text-[#829195]">
                            Scheduled {new Date(event.scheduled_at).toLocaleString()}
                            {event.recorded_at && <> · Recorded {new Date(event.recorded_at).toLocaleString()}</>}
                            {event.recorded_by && <> · Recorded by a care-team member</>}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                ) : <EmptyState title="No recent dose events" description="Recorded medication events will appear here." />}
              </section>
            </div>
          </>
      </div>
    </WorkspaceShell>
  );
}

function calculateAge(dateOfBirth: string): number | null {
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

function ProfileStat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <div className="flex items-center gap-3 rounded-xl border border-[#dfe7e4] bg-white px-4 py-4"><span className="grid size-8 place-items-center rounded-lg bg-[#edf5f2] text-[#4d897b]">{icon}</span><div><p className="text-[10px] text-[#829195]">{label}</p><p className="mt-0.5 text-lg font-semibold leading-none text-[#29434b]">{value}</p></div></div>;
}

function SectionHeading({ eyebrow, title, icon }: { eyebrow: string; title: string; icon: ReactNode }) {
  return <div className="flex items-start justify-between gap-3 border-b border-[#e9eeec] pb-3"><div><p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#769087]">{eyebrow}</p><h2 className="mt-1 text-sm font-semibold text-[#18343c]">{title}</h2></div><span className="text-[#598178]">{icon}</span></div>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="px-1 py-4"><p className="text-xs font-semibold text-[#405a61]">{title}</p><p className="mt-1 text-[11px] leading-relaxed text-[#849397]">{description}</p></div>;
}
