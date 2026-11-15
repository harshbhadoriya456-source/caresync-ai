import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Activity, Pill, Search, ShieldAlert } from "lucide-react";
import { MedicationCard } from "@/components/dashboard/MedicationCard";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { WorkspaceLoading } from "@/components/layout/WorkspaceLoading";
import { MedicationForm } from "@/components/forms/MedicationForm";
import { loadCareWorkspace } from "@/lib/data/workspace";

interface MedicationsPageProps {
  searchParams: Promise<{ careProfileId?: string | string[]; q?: string | string[] }>;
}

export default function MedicationsPage({ searchParams }: MedicationsPageProps) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <MedicationsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MedicationsContent({ searchParams }: MedicationsPageProps) {
  const query = await searchParams;
  const careProfileId = Array.isArray(query.careProfileId) ? query.careProfileId[0] : query.careProfileId;
  const search = (Array.isArray(query.q) ? query.q[0] : query.q)?.trim().toLowerCase() ?? "";
  const workspace = await loadCareWorkspace(careProfileId);
  const { careProfile, activeMembership } = workspace;
  if (!careProfile || !activeMembership) notFound();

  const canRead =
    activeMembership.role === "owner" ||
    activeMembership.role === "elderly" ||
    activeMembership.permissions.some((permission) =>
      ["read_healthcare", "manage_medications", "record_medication_events"].includes(permission)
    );
  const canManage =
    activeMembership.role === "owner" ||
    activeMembership.permissions.includes("manage_medications");
  if (!canRead) {
    return (
      <WorkspaceShell
        userEmail={workspace.user.email}
        role={activeMembership.role}
        permissions={activeMembership.permissions}
        careProfiles={[]}
        selectedCareProfileId={null}
      >
        <RestrictedNotice />
      </WorkspaceShell>
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  const activeMedications = workspace.medications.filter(
    (medication) =>
      medication.start_date <= today &&
      (!medication.end_date || medication.end_date >= today) &&
      (!search || medication.name.toLowerCase().includes(search))
  );
  const archivedMedications = workspace.medications.filter(
    (medication) =>
      (medication.start_date > today || (medication.end_date && medication.end_date < today)) &&
      (!search || medication.name.toLowerCase().includes(search))
  );
  const recordedCount = workspace.medicationEvents.filter((event) =>
    ["taken", "skipped", "missed", "unconfirmed"].includes(event.status)
  ).length;

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
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#18343c]">Medication schedule</h1>
            <p className="mt-1.5 text-sm text-[#73868b]">Documented medication details and dose events for this care profile.</p>
          </div>
          <div className="flex gap-2">
            <Metric label="Active" value={activeMedications.length} />
            <Metric label="Recorded events · 30d" value={recordedCount} />
          </div>
        </header>

        <>
            {canManage && <MedicationForm careProfileId={careProfile.id} />}
            <form action="/medications" className="flex gap-2">
              <input type="hidden" name="careProfileId" value={careProfile.id} />
              <label className="relative flex-1">
                <span className="sr-only">Search medication names</span>
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#849397]" />
                <input name="q" defaultValue={search} placeholder="Search medication names" className="h-10 w-full rounded-lg border border-[#dfe7e4] bg-white pl-9 pr-3 text-xs text-[#29434b] outline-none focus:border-[#558f84] focus:ring-2 focus:ring-[#558f84]/15" />
              </label>
              <button type="submit" className="min-h-10 rounded-lg border border-[#d7e2de] bg-white px-4 text-xs font-semibold text-[#42695f] hover:bg-[#f8faf9]">Search</button>
            </form>

            <section className="overflow-hidden rounded-xl border border-[#dfe7e4] bg-white shadow-[0_8px_24px_-20px_rgba(18,44,51,.35)]">
              <div className="flex items-center justify-between border-b border-[#e9eeec] px-5 py-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#769087]">Current plan</p>
                  <h2 className="mt-1 text-base font-semibold text-[#18343c]">Active medication records</h2>
                </div>
                <Pill size={17} className="text-[#598178]" />
              </div>
              {activeMedications.length ? (
                <div className="divide-y divide-[#edf1ef]">
                  {activeMedications.map((medication) => (
                    <MedicationCard
                      key={medication.id}
                      medication={medication}
                      events={workspace.medicationEvents.filter((event) => event.medication_id === medication.id)}
                      canRecord={
                        activeMembership.role === "owner" ||
                        activeMembership.role === "elderly" ||
                        activeMembership.permissions.includes("record_medication_events") ||
                        activeMembership.permissions.includes("manage_medications")
                      }
                    />
                  ))}
                </div>
              ) : (
                <EmptyState title={search ? "No matching medications" : "No active medication records"} description="Medication records will appear here when available for this care profile." />
              )}
            </section>

            <section className="overflow-hidden rounded-xl border border-[#dfe7e4] bg-white">
              <div className="border-b border-[#e9eeec] px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#769087]">History</p>
                <h2 className="mt-1 text-base font-semibold text-[#18343c]">Ended or not-yet-started records</h2>
              </div>
              {archivedMedications.length ? (
                <ul className="divide-y divide-[#edf1ef]">
                  {archivedMedications.map((medication) => (
                    <li key={medication.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <div>
                        <p className="text-sm font-semibold text-[#29434b]">{medication.name}</p>
                        <p className="mt-1 text-[11px] text-[#7b8d91]">{medication.dosage} · {medication.frequency}</p>
                      </div>
                      <p className="text-[10px] text-[#829195]">
                        {medication.start_date} – {medication.end_date ?? "No end date"}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No medication history" description="Ended medication records will appear in this section." />
              )}
            </section>
            <p className="flex items-start gap-2 text-[10px] leading-relaxed text-[#7c8e92]">
              <ShieldAlert size={13} className="mt-0.5 shrink-0" />
              This workspace records the existing care plan and dose events. It does not recommend prescription changes or dose adjustments.
            </p>
        </>
      </div>
    </WorkspaceShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-[#dfe7e4] bg-white px-3 py-2"><p className="text-[9px] uppercase tracking-wide text-[#849397]">{label}</p><p className="mt-1 text-lg font-semibold leading-none text-[#29434b]">{value}</p></div>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="flex items-start gap-3 px-5 py-5"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f0f5f3] text-[#61867e]"><Activity size={17} /></span><div><p className="text-xs font-semibold text-[#405a61]">{title}</p><p className="mt-1 text-[11px] leading-relaxed text-[#849397]">{description}</p></div></div>;
}

function RestrictedNotice() {
  return <section className="rounded-xl border border-[#dfe7e4] bg-white p-6 text-sm leading-relaxed text-[#61777d]">Your care-profile membership does not grant access to medication details. Contact the profile owner if you need additional access.</section>;
}
