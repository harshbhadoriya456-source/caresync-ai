"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  HeartPulse,
  LogOut,
  Menu,
  Search,
  Shield,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CareMembership, CareProfile, CareRole } from "@/types/database";

interface WorkspaceShellProps {
  userEmail: string | null;
  role: CareRole | null;
  permissions: CareMembership["permissions"];
  careProfiles: CareProfile[];
  selectedCareProfileId: string | null;
  children: React.ReactNode;
}

const roleLabels: Record<CareRole, string> = {
  owner: "Care administrator",
  caretaker: "Clinical team",
  elderly: "Patient",
  family: "Family member",
};

export function WorkspaceShell({
  userEmail,
  role,
  permissions,
  careProfiles,
  selectedCareProfileId,
  children,
}: WorkspaceShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const canReadHealthcare =
    role === "owner" ||
    role === "elderly" ||
    permissions.some((permission) =>
      [
        "read_healthcare",
        "manage_medications",
        "record_medication_events",
        "manage_appointments",
      ].includes(permission)
    );

  const navigation = [
    { href: "/dashboard", label: "Overview", icon: Activity, visible: true },
    {
      href: "/patients",
      label: "Patients",
      icon: Users,
      visible:
        role === "owner" ||
        (role === "caretaker" &&
          permissions.some((permission) =>
            [
              "read_healthcare",
              "manage_medications",
              "record_medication_events",
              "manage_appointments",
            ].includes(permission)
          )),
    },
    {
      href: "/medications",
      label: "Medications",
      icon: HeartPulse,
      visible: canReadHealthcare,
    },
    {
      href: "/appointments",
      label: "Appointments",
      icon: CalendarDays,
      visible: canReadHealthcare,
    },
    {
      href: "/team",
      label: "Care team",
      icon: Shield,
      visible: role === "owner",
    },
  ].filter((item) => item.visible);

  const activeSection =
    navigation.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    )?.label ?? "Overview";

  const handleSignOut = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSignOutError("Unable to sign out. Please try again.");
      return;
    }
    router.replace("/login");
    router.refresh();
  };

  const sidebar = (
    <>
      <Link href="/dashboard" className="flex items-center gap-3 px-5 pt-6 pb-8">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/10 text-[#a7e1d5]">
          <HeartPulse size={21} strokeWidth={2.2} />
        </span>
        <span>
          <span className="block font-semibold tracking-tight text-white">
            caresync<span className="text-[#8fc8bb]">.</span>
          </span>
          <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
            Care coordination
          </span>
        </span>
      </Link>

      <div className="px-3">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Workspace
        </p>
        <nav aria-label="Primary navigation" className="space-y-1">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
            const target = href === "/dashboard" ? `${href}${selectedCareProfileId ? `?careProfileId=${encodeURIComponent(selectedCareProfileId)}` : ""}` : href;
            return (
              <Link
                key={href}
                href={target}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`group flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-[#183e48] text-white shadow-[inset_2px_0_0_#91cfc1]"
                    : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
                }`}
              >
                <Icon size={17} strokeWidth={1.8} className={active ? "text-[#a7e1d5]" : ""} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto px-3 pb-4">
        <div className="mb-3 rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-300">
            <span className="size-1.5 rounded-full bg-[#8fc8a8]" />
            Private care workspace
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
            Access follows your assigned care-team permissions.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-[12px] font-medium text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <LogOut size={16} />
          Sign out
        </button>
        {signOutError && (
          <p role="alert" className="px-3 pt-2 text-xs text-rose-300">
            {signOutError}
          </p>
        )}
      </div>
    </>
  );

  return (
    <div className={`min-h-screen bg-[#f3f5f4] text-[#152b34] ${role === "elderly" ? "elderly-mode" : ""}`}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-[#101f2a] lg:flex">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#07141d]/60 backdrop-blur-[2px]"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-[min(84vw,300px)] flex-col bg-[#101f2a] shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-5 grid size-9 place-items-center rounded-lg text-slate-300 hover:bg-white/10"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-h-screen lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-[#dfe6e4] bg-[#f8faf9]/90 backdrop-blur-xl">
          <div className="flex h-[68px] items-center gap-3 px-4 sm:px-7 xl:px-10">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#dfe6e4] bg-white text-[#304a53] lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={19} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-[#71858b]">CareSync / {activeSection}</p>
              <p className="truncate text-sm font-semibold text-[#17323b]">
                {careProfiles.find((profile) => profile.id === selectedCareProfileId)?.display_name ??
                  "Care workspace"}
              </p>
            </div>

            <form action="/patients" className="hidden max-w-[320px] flex-1 md:block">
              <label className="sr-only" htmlFor="workspace-search">Search patients</label>
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#809198]" />
                <input
                  id="workspace-search"
                  name="q"
                  placeholder="Search patients"
                  className="h-10 w-full rounded-lg border border-[#dfe6e4] bg-white/80 pl-9 pr-3 text-[12px] outline-none transition focus:border-[#558f84] focus:ring-2 focus:ring-[#558f84]/15"
                />
              </div>
            </form>

            {careProfiles.length > 1 && (
              <label className="relative hidden items-center gap-2 rounded-lg border border-[#dfe6e4] bg-white px-3 py-2 text-xs font-medium text-[#304a53] sm:flex">
                <ClipboardList size={15} className="text-[#558f84]" />
                <span className="sr-only">Select care profile</span>
                <select
                  value={selectedCareProfileId ?? ""}
                  onChange={(event) => {
                    const selectedId = event.target.value;
                    router.push(`/dashboard?careProfileId=${encodeURIComponent(selectedId)}`);
                  }}
                  className="max-w-[150px] appearance-none bg-transparent pr-4 outline-none"
                >
                  {careProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.display_name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-2 text-[#809198]" />
              </label>
            )}

            <div className="hidden items-center gap-2 border-l border-[#dfe6e4] pl-3 sm:flex">
              <div className="grid size-8 place-items-center rounded-full bg-[#dcece8] text-[11px] font-semibold uppercase text-[#2e665d]">
                {userEmail?.slice(0, 1) ?? "C"}
              </div>
              <div className="hidden xl:block">
                <p className="max-w-[150px] truncate text-[11px] font-semibold text-[#28434c]">
                  {userEmail ?? "Signed in"}
                </p>
                <p className="text-[10px] text-[#7b8b90]">
                  {role ? roleLabels[role] : "No active care role"}
                </p>
              </div>
            </div>
            <Link
              href="/dashboard#support"
              aria-label="Help and support"
              className="grid size-9 shrink-0 place-items-center rounded-lg text-[#637980] hover:bg-[#eaf0ee]"
            >
              <CircleHelp size={17} />
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1540px] px-4 py-6 sm:px-7 sm:py-8 xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
