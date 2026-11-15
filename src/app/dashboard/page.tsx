import Link from "next/link";
import { Suspense } from "react";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { WorkspaceLoading } from "@/components/layout/WorkspaceLoading";
import { loadCareWorkspace } from "@/lib/data/workspace";

interface DashboardPageProps {
  searchParams: Promise<{ careProfileId?: string | string[] }>;
}

export default function DashboardPage({ searchParams }: DashboardPageProps) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardContent({ searchParams }: DashboardPageProps) {
  const query = await searchParams;
  const careProfileId = Array.isArray(query.careProfileId)
    ? query.careProfileId[0]
    : query.careProfileId;
  const workspace = await loadCareWorkspace(careProfileId);
  const { careProfile, activeMembership } = workspace;

  if (!careProfile || !activeMembership) {
    return (
      <WorkspaceShell
        userEmail={workspace.user.email}
        role={null}
        permissions={[]}
        careProfiles={workspace.careProfiles}
        selectedCareProfileId={null}
      >
        <section className="mx-auto max-w-2xl rounded-xl border border-[#dfe7e4] bg-white p-7 shadow-sm sm:p-9">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#769087]">CareSync workspace</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#18343c]">No care profile is linked yet</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#6b7f85]">
            When your account is added to a care profile, its authorized patient information and workflows will appear here.
          </p>
          <Link href="/login" className="mt-5 inline-flex text-xs font-semibold text-[#34776b] hover:underline">Return to sign in</Link>
        </section>
      </WorkspaceShell>
    );
  }

  if (
    activeMembership.role !== "owner" &&
    activeMembership.role !== "elderly" &&
    !activeMembership.permissions.some((permission) =>
      ["read_healthcare", "manage_medications", "record_medication_events", "manage_appointments"].includes(permission)
    )
  ) {
    return (
      <WorkspaceShell
        userEmail={workspace.user.email}
        role={activeMembership.role}
        permissions={activeMembership.permissions}
        careProfiles={[]}
        selectedCareProfileId={null}
      >
        <section className="rounded-xl border border-[#dfe7e4] bg-white p-7 text-sm leading-relaxed text-[#61777d]">
          Your membership does not currently include access to healthcare details. Contact the care-profile owner if you need additional access.
        </section>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      userEmail={workspace.user.email}
      role={activeMembership.role}
      permissions={activeMembership.permissions}
      careProfiles={workspace.careProfiles}
      selectedCareProfileId={careProfile.id}
    >
      <DashboardView
        careProfile={careProfile}
        role={activeMembership.role}
        permissions={activeMembership.permissions}
        medications={workspace.medications}
        medicationEvents={workspace.medicationEvents}
        appointments={workspace.appointments}
        members={workspace.memberships}
        referenceTime={new Date(workspace.referenceTime).getTime()}
      />
    </WorkspaceShell>
  );
}
