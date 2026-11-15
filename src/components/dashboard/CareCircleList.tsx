import { Heart, Shield, UserCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { CareMembership, CareRole } from "@/types/database";

interface CareCircleListProps {
  members: CareMembership[];
}

const roleBadgeVariants: Record<CareRole, "teal" | "sage" | "amber" | "neutral"> = {
  owner: "teal",
  elderly: "sage",
  caretaker: "amber",
  family: "neutral",
};

export function CareCircleList({ members }: CareCircleListProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#dfe7e4] bg-white shadow-[0_8px_24px_-20px_rgba(18,44,51,.35)]">
      <header className="flex items-center justify-between border-b border-[#e9eeec] px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#769087]">Coordination</p>
          <h2 className="mt-1 text-base font-semibold text-[#18343c]">Care team</h2>
        </div>
        <span className="grid size-8 place-items-center rounded-lg bg-[#edf5f2] text-[#4d897b]"><Users size={16} /></span>
      </header>
      {members.length ? (
        <ul className="divide-y divide-[#edf1ef] px-5">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[#e3ebe7] bg-[#f8faf9] text-[#5b8077]">
                  {member.role === "elderly" ? <Heart size={14} /> : member.role === "owner" ? <Shield size={14} /> : <UserCheck size={14} />}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#405a61]">{member.profile?.full_name ?? `${member.role[0]?.toUpperCase()}${member.role.slice(1)} member`}</p>
                  {member.profile?.email && <p className="truncate text-[10px] text-[#829195]">{member.profile.email}</p>}
                </div>
              </div>
              <Badge variant={roleBadgeVariants[member.role]} size="sm"><span className="capitalize">{member.role}</span></Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-5 text-xs text-[#849397]">No active care-team memberships are available.</p>
      )}
    </section>
  );
}
