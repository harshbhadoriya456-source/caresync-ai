import React from "react";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  floating?: boolean;
  interactive?: boolean;
  id?: string;
}

export function GlassCard({
  children,
  className = "",
  floating = false,
  interactive = false,
  id,
}: GlassCardProps) {
  const baseClass = floating
    ? "glass-panel-floating rounded-2xl"
    : interactive
    ? "glass-card-interactive rounded-2xl"
    : "glass-panel rounded-2xl";

  return (
    <div id={id} className={`${baseClass} p-6 sm:p-7 ${className}`}>
      {children}
    </div>
  );
}
