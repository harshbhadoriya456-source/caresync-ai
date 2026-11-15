import { CalendarDays, Clock3 } from "lucide-react";
import { Suspense } from "react";
import { AppointmentCard } from "@/components/dashboard/AppointmentCard";
import { AppointmentForm } from "@/components/forms/AppointmentForm";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { WorkspaceLoading } from "@/components/layout/WorkspaceLoading";
import { loadCareWorkspace } from "@/lib/data/workspace";

interface AppointmentsPageProps {
  searchParams: Promise<{ careProfileId?: string | string[] }>;
}

export default function AppointmentsPage({ searchParams }: AppointmentsPageProps) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <AppointmentsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AppointmentsContent({ searchParams }: AppointmentsPageProps) {
  const query = await searchParams;
  const careProfileId = Array.isArray(query.careProfileId) ? query.careProfileId[0] : query.careProfileId;
  const workspace = await loadCareWorkspace(careProfileId);
  const { careProfile, activeMembership } = workspace;

  if (!careProfile || !activeMembership) {
    return (
      <WorkspaceShell userEmail={workspace.user.email} role={null} permissions={[]} careProfiles={[]} selectedCareProfileId={null}>
        <section className="rounded-xl border border-[#dfe7e4] bg-white p-7 text-sm text-[#61777d]">No care profile is linked to this account yet.</section>
      </WorkspaceShell>
    );
  }

  const canRead =
    activeMembership.role === "owner" ||
    activeMembership.role === "elderly" ||
    activeMembership.permissions.some((permission) =>
      ["read_healthcare", "manage_appointments"].includes(permission)
    );
  const canManage =
    activeMembership.role === "owner" ||
    activeMembership.permissions.includes("manage_appointments");
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
          Your care-profile membership does not grant access to appointment details.
        </section>
      </WorkspaceShell>
    );
  }
  const now = new Date(workspace.referenceTime).getTime();
  const upcoming = workspace.appointments.filter((item) => new Date(item.appointment_at).getTime() >= now);
  const past = workspace.appointments.filter((item) => new Date(item.appointment_at).getTime() < now).reverse();

  return (
    <WorkspaceShell
      userEmail={workspace.user.email}
      role={activeMembership.role}
      permissions={activeMembership.permissions}
      careProfiles={workspace.careProfiles}
      selectedCareProfileId={careProfile.id}
    >
      <div className="space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#769087]">Care record / {careProfile.display_name}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#18343c]">Appointments</h1>
            <p className="mt-1.5 text-sm text-[#73868b]">Scheduled and completed visits recorded for this care profile.</p>
          </div>
          <div className="flex gap-2">
            <Metric label="Upcoming" value={upcoming.length} />
            <Metric label="Past" value={past.length} />
          </div>
        </header>
        <>
            {canManage && <AppointmentForm careProfileId={careProfile.id} />}
            <section className="overflow-hidden rounded-xl border border-[#dfe7e4] bg-white shadow-[0_8px_24px_-20px_rgba(18,44,51,.35)]">
              <div className="flex items-center justify-between border-b border-[#e9eeec] px-5 py-4">
                <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#769087]">Schedule</p><h2 className="mt-1 text-base font-semibold text-[#18343c]">Upcoming visits</h2></div>
                <CalendarDays size={17} className="text-[#598178]" />
              </div>
              {upcoming.length ? <div className="divide-y divide-[#edf1ef]">{upcoming.map((appointment) => <div key={appointment.id} className="px-5 py-4"><AppointmentCard appointment={appointment} referenceTime={now} /></div>)}</div> : <EmptyState title="No upcoming appointments" description="Newly scheduled visits for this care profile will appear here." />}
            </section>
            <section className="overflow-hidden rounded-xl border border-[#dfe7e4] bg-white">
              <div className="flex items-center justify-between border-b border-[#e9eeec] px-5 py-4">
                <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#769087]">Record</p><h2 className="mt-1 text-base font-semibold text-[#18343c]">Past appointments</h2></div>
                <Clock3 size={16} className="text-[#829397]" />
              </div>
              {past.length ? <div className="divide-y divide-[#edf1ef]">{past.map((appointment) => <div key={appointment.id} className="px-5 py-4"><AppointmentCard appointment={appointment} referenceTime={now} /></div>)}</div> : <EmptyState title="No completed visits recorded" description="Past appointment entries will remain available here for reference." />}
            </section>
        </>
      </div>
    </WorkspaceShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-[#dfe7e4] bg-white px-3 py-2"><p className="text-[9px] uppercase tracking-wide text-[#849397]">{label}</p><p className="mt-1 text-lg font-semibold leading-none text-[#29434b]">{value}</p></div>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="flex items-start gap-3 px-5 py-5"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f0f5f3] text-[#61867e]"><CalendarDays size={17} /></span><div><p className="text-xs font-semibold text-[#405a61]">{title}</p><p className="mt-1 text-[11px] leading-relaxed text-[#849397]">{description}</p></div></div>;
}
