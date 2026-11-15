import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ShieldCheck, Users } from "lucide-react";
import { CareMemberEditor } from "@/components/forms/CareMemberEditor";
import { InviteForm } from "@/components/forms/InviteForm";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { WorkspaceLoading } from "@/components/layout/WorkspaceLoading";
import { loadCareWorkspace } from "@/lib/data/workspace";

interface TeamPageProps {
  searchParams: Promise<{ careProfileId?: string | string[] }>;
}

export default function TeamPage({ searchParams }: TeamPageProps) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <TeamContent searchParams={searchParams} />
    </Suspense>
  );
}

async function TeamContent({ searchParams }: TeamPageProps) {
  const query = await searchParams;
  const careProfileId = Array.isArray(query.careProfileId) ? query.careProfileId[0] : query.careProfileId;
  const workspace = await loadCareWorkspace(careProfileId);
  const { careProfile, activeMembership } = workspace;
  if (!careProfile || !activeMembership) redirect("/dashboard");
  if (activeMembership.role !== "owner") redirect("/dashboard");

  return (
    <WorkspaceShell
      userEmail={workspace.user.email}
      role={activeMembership.role}
      permissions={activeMembership.permissions}
      careProfiles={workspace.careProfiles}
      selectedCareProfileId={careProfile.id}
    >
      <div className="mx-auto max-w-[1120px] space-y-6">
        <header className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e8f1ee] text-[#39776c]"><Users size={19} /></span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#769087]">Access administration / {careProfile.display_name}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#18343c]">Care team & permissions</h1>
            <p className="mt-1.5 text-sm text-[#73868b]">Invite members and grant only the access they need.</p>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,.8fr)]">
          <section className="overflow-hidden rounded-xl border border-[#dfe7e4] bg-white shadow-[0_8px_24px_-20px_rgba(18,44,51,.35)]">
            <div className="flex items-center justify-between border-b border-[#e9eeec] px-5 py-4">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#769087]">Active memberships</p><h2 className="mt-1 text-base font-semibold text-[#18343c]">People with access</h2></div>
              <span className="rounded-full bg-[#edf4f1] px-2.5 py-1 text-[10px] font-semibold text-[#52776d]">{workspace.memberships.length}</span>
            </div>
            {workspace.memberships.length ? (
              <ul className="divide-y divide-[#edf1ef]">
                {workspace.memberships.map((member) => (
                  <li key={member.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
                      <div>
                        <p className="text-sm font-semibold capitalize text-[#29434b]">{member.profile?.full_name ?? `${member.role} member`}</p>
                        <p className="mt-1 text-[10px] text-[#829195]">{member.profile?.email ?? "Member details are not available to this view."}</p>
                      </div>
                      <span className="rounded-full border border-[#dce7e3] bg-[#f7faf8] px-2.5 py-1 text-[10px] font-medium capitalize text-[#54736d]">{member.role}</span>
                    </div>
                    {member.role !== "owner" && member.role !== "elderly" && (
                      <CareMemberEditor member={member} />
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-6 text-sm text-[#788b8f]">There are no active memberships on this profile.</div>
            )}
          </section>

          <div className="space-y-5">
            <InviteForm careProfileId={careProfile.id} />
            <section className="rounded-xl border border-[#dfe7e4] bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-[#4d897b]" /><h2 className="text-sm font-semibold text-[#29434b]">Permission model</h2></div>
              <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-[#75878b]">
                <li><strong className="text-[#405a61]">Owner</strong> administers profile membership and access.</li>
                <li><strong className="text-[#405a61]">Caretaker and family</strong> receive only the permissions explicitly granted above.</li>
                <li><strong className="text-[#405a61]">Patient</strong> membership is retained separately and cannot be changed here.</li>
              </ul>
              <p className="mt-4 border-t border-[#e9eeec] pt-3 text-[10px] leading-relaxed text-[#8a999d]">Database policies remain authoritative. Failed or unauthorized changes are rejected by the server.</p>
            </section>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
