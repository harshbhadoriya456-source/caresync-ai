"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Heart,
  Pill,
  Calendar,
  Users,
  ShieldCheck,
  Menu,
  X,
  Activity,
  Bell
} from "lucide-react";
import type { CareRole } from "@/types/database";

interface HeaderProps {
  userEmail?: string | null;
  activeRole?: CareRole;
  onRoleChange?: (role: CareRole) => void;
  elderlyMode?: boolean;
  onToggleElderlyMode?: () => void;
}

export function Header({
  userEmail,
  activeRole = "caretaker",
  onRoleChange,
  elderlyMode = false,
  onToggleElderlyMode,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const roles: { id: CareRole; label: string; desc: string }[] = [
    { id: "elderly", label: "Patient View", desc: "Large text & simplified" },
    { id: "caretaker", label: "Caregiver", desc: "Medication & task focus" },
    { id: "family", label: "Family Circle", desc: "Updates & schedule" },
    { id: "owner", label: "Care Admin", desc: "Full permissions" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full px-4 sm:px-8 py-3.5">
      <div className="max-w-7xl mx-auto glass-panel-floating rounded-2xl px-5 sm:px-6 py-3 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-[#0D7C7A] text-white flex items-center justify-center shadow-md shadow-teal-900/10 transition-transform group-hover:scale-105">
            <Heart className="w-5 h-5 fill-white/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-[#0B192C]">
                CareSync<span className="text-[#0D7C7A]"> AI</span>
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EAF4EE] text-[#1E4D38] border border-[#B7DEC8]">
                HIPAA Ready
              </span>
            </div>
            <p className="text-xs text-[#4A5B72] hidden sm:block">
              Elderly Healthcare Coordination
            </p>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1.5 bg-[#0B192C]/[0.03] p-1 rounded-xl border border-black/[0.04]">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium text-[#152238] hover:bg-white hover:shadow-xs transition-all"
          >
            <Activity className="w-4 h-4 text-[#0D7C7A]" />
            Dashboard
          </Link>
          <Link
            href="/medications"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium text-[#4A5B72] hover:text-[#152238] hover:bg-white transition-all"
          >
            <Pill className="w-4 h-4 text-[#4A5B72]" />
            Medications
          </Link>
          <Link
            href="/appointments"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium text-[#4A5B72] hover:text-[#152238] hover:bg-white transition-all"
          >
            <Calendar className="w-4 h-4 text-[#4A5B72]" />
            Schedule
          </Link>
          <Link
            href="/team"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium text-[#4A5B72] hover:text-[#152238] hover:bg-white transition-all"
          >
            <Users className="w-4 h-4 text-[#4A5B72]" />
            Care Circle
          </Link>
        </nav>

        {/* Role Switcher & Accessibility Control */}
        <div className="hidden lg:flex items-center gap-3">
          {/* Elderly High-Readability Mode Toggle */}
          {onToggleElderlyMode && (
            <button
              onClick={onToggleElderlyMode}
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                elderlyMode
                  ? "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D] shadow-xs"
                  : "bg-white/80 text-[#4A5B72] border-black/[0.08] hover:border-black/[0.15]"
              }`}
              title="Toggle Large Text & High Contrast Mode"
            >
              <span className="text-base font-bold">Aa</span>
              <span>{elderlyMode ? "Senior Mode On" : "Senior Mode"}</span>
            </button>
          )}

          {/* Role selector dropdown */}
          {onRoleChange && (
            <div className="relative group">
              <button className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-xl bg-white/90 border border-black/[0.08] hover:border-[#0D7C7A]/40 text-[#152238] transition-all cursor-pointer shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0D7C7A]" />
                <span className="capitalize font-semibold">{activeRole} View</span>
              </button>
              <div className="absolute right-0 mt-2 w-52 glass-panel-floating rounded-xl p-1.5 hidden group-hover:block transition-all z-50">
                <div className="text-[11px] font-semibold px-2 py-1 text-[#7E8E9F] uppercase tracking-wider">
                  Switch Persona View
                </div>
                {roles.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onRoleChange(r.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex flex-col ${
                      activeRole === r.id
                        ? "bg-[#0D7C7A]/10 text-[#0D7C7A] font-semibold"
                        : "text-[#152238] hover:bg-black/[0.04]"
                    }`}
                  >
                    <span>{r.label}</span>
                    <span className="text-[10px] text-[#7E8E9F] font-normal">{r.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notifications icon */}
          <button className="w-8 h-8 rounded-xl bg-white/80 border border-black/[0.08] text-[#4A5B72] hover:text-[#0B192C] flex items-center justify-center transition-all cursor-pointer">
            <Bell className="w-4 h-4" />
          </button>

          {/* Auth context / user pill */}
          {userEmail ? (
            <div className="flex items-center gap-2 pl-2 border-l border-black/[0.08]">
              <div className="w-7 h-7 rounded-full bg-[#0D7C7A]/15 text-[#0D7C7A] font-semibold text-xs flex items-center justify-center">
                {userEmail.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-[#4A5B72] max-w-[120px] truncate">
                {userEmail}
              </span>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-[#0D7C7A] text-white hover:bg-[#0A6361] transition-all"
            >
              Sign In
            </Link>
          )}
        </div>

        {/* Mobile menu trigger */}
        <div className="flex items-center gap-2 md:hidden">
          {onToggleElderlyMode && (
            <button
              onClick={onToggleElderlyMode}
              className="text-xs font-bold px-2 py-1 rounded-lg border bg-white text-[#152238]"
            >
              Aa
            </button>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-9 h-9 rounded-xl bg-white/80 border border-black/[0.08] flex items-center justify-center text-[#152238] cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-2 max-w-7xl mx-auto glass-panel-floating rounded-2xl p-4 flex flex-col gap-3 shadow-xl">
          <nav className="flex flex-col gap-1">
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-[#152238] bg-black/[0.03]"
            >
              <Activity className="w-4 h-4 text-[#0D7C7A]" />
              Dashboard
            </Link>
            <Link
              href="/medications"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-[#4A5B72]"
            >
              <Pill className="w-4 h-4 text-[#0D7C7A]" />
              Medications
            </Link>
            <Link
              href="/appointments"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-[#4A5B72]"
            >
              <Calendar className="w-4 h-4 text-[#0D7C7A]" />
              Schedule & Visits
            </Link>
            <Link
              href="/team"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-[#4A5B72]"
            >
              <Users className="w-4 h-4 text-[#0D7C7A]" />
              Care Circle & Family
            </Link>
          </nav>

          {onRoleChange && (
            <div className="pt-2 border-t border-black/[0.08]">
              <p className="text-xs font-semibold text-[#7E8E9F] uppercase tracking-wider mb-1.5">
                Switch Perspective
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {roles.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      onRoleChange(r.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors ${
                      activeRole === r.id
                        ? "bg-[#0D7C7A] text-white font-semibold"
                        : "bg-white text-[#152238] border border-black/[0.06]"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
