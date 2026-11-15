import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, Search, Users } from "lucide-react";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { WorkspaceLoading } from "@/components/layout/WorkspaceLoading";
import { loadCareWorkspace } from "@/lib/data/workspace";

interface PatientsPageProps {
  searchParams: Promise<{ careProfileId?: string | string[]; q?: string | string[] }>;
}

export default function PatientsPage({ searchParams }: PatientsPageProps) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <PatientsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PatientsContent({ searchParams }: PatientsPageProps) {
  const query = await searchParams;
  const requestedId = Array.isArray(query.careProfileId) ? query.careProfileId[0] : query.careProfileId;
  const search = (Array.isArray(query.q) ? query.q[0] : query.q)?.trim().toLowerCase() ?? "";
  const workspace = await loadCareWorkspace(requestedId);
  const { activeMembership } = workspace;
  if (
    !activeMembership ||
    (activeMembership.role !== "owner" &&
      (activeMembership.role !== "caretaker" ||
        !activeMembership.permissions.some((permission) =>
          ["read_healthcare", "manage_medications", "record_medication_events", "manage_appointments"].includes(permission)
        )))
  ) {
    redirect("/dashboard");
  }

  const visibleProfiles = workspace.careProfiles.filter((profile) =>
    !search || profile.display_name.toLowerCase().includes(search)
  );

  return (
    <WorkspaceShell
      userEmail={workspace.user.email}
      role={activeMembership.role}
      permissions={activeMembership.permissions}
      careProfiles={workspace.careProfiles}
      selectedCareProfileId={workspace.careProfile?.id ?? null}
    >
      <div className="mx-auto max-w-[1200px] space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#769087]">Clinical workspace</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#18343c]">Patient directory</h1>
            <p className="mt-1.5 text-sm text-[#73868b]">Only care profiles linked to your active memberships are listed.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-lg border border-[#dfe7e4] bg-white px-3 py-2 text-xs text-[#70848a]"><Users size={15} className="text-[#598178]" />{workspace.careProfiles.length} accessible profiles</span>
        </header>
        <form action="/patients" className="flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Search patients</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#849397]" />
            <input name="q" defaultValue={search} placeholder="Search patient profiles" className="h-10 w-full rounded-lg border border-[#dfe7e4] bg-white pl-9 pr-3 text-xs text-[#29434b] outline-none focus:border-[#558f84] focus:ring-2 focus:ring-[#558f84]/15" />
          </label>
          <button type="submit" className="min-h-10 rounded-lg border border-[#d7e2de] bg-white px-4 text-xs font-semibold text-[#42695f] hover:bg-[#f8faf9]">Search</button>
        </form>
        {visibleProfiles.length ? (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleProfiles.map((profile) => {
              const age = profile.date_of_birth ? getAge(profile.date_of_birth) : null;
              return (
                <li key={profile.id}>
                  <Link href={`/patients/${profile.id}`} className="group block h-full rounded-xl border border-[#dfe7e4] bg-white p-5 shadow-[0_8px_24px_-22px_rgba(18,44,51,.4)] transition hover:-translate-y-0.5 hover:border-[#c4d8d1] hover:shadow-[0_14px_30px_-20px_rgba(18,44,51,.4)]">
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid size-10 place-items-center rounded-xl bg-[#eaf3f0] text-[#4c8175]"><Users size={18} /></span>
                      <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${profile.status === "active" ? "bg-[#e9f4ed] text-[#3b7653]" : "bg-[#eef1f0] text-[#64787d]"}`}>{profile.status === "active" ? "Active" : "Closed"}</span>
                    </div>
                    <h2 className="mt-4 text-base font-semibold text-[#213d45]">{profile.display_name}</h2>
                    <p className="mt-1 text-[11px] text-[#7b8d91]">{age === null ? "Date of birth not recorded" : `Age ${age}`}</p>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#47796e] group-hover:text-[#183e48]">Open patient record <ArrowRight size={13} /></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <section className="rounded-xl border border-dashed border-[#d7e2de] bg-white/70 p-8 text-center">
            <p className="text-sm font-semibold text-[#405a61]">{search ? "No patient profiles match this search" : "No patient profiles available"}</p>
            <p className="mt-1 text-xs text-[#849397]">Profiles appear here after an authorized care-team membership is active.</p>
          </section>
        )}
      </div>
    </WorkspaceShell>
  );
}

function getAge(dateOfBirth: string): number | null {
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}
