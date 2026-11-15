import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "sage" | "amber" | "rose" | "teal" | "neutral";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Badge({
  children,
  variant = "neutral",
  size = "md",
  className = "",
}: BadgeProps) {
  const variantStyles = {
    sage: "bg-[#EAF4EE] text-[#1E4D38] border-[#B7DEC8]",
    amber: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
    rose: "bg-[#FFE4E6] text-[#9F1239] border-[#FDA4AF]",
    teal: "bg-[#E6F4F4] text-[#0A6361] border-[#B2DFDB]",
    neutral: "bg-black/[0.04] text-[#4A5B72] border-black/[0.08]",
  };

  const sizeStyles = {
    sm: "text-xs px-2 py-0.5 font-medium rounded-full",
    md: "text-xs px-2.5 py-1 font-semibold rounded-full tracking-wide",
    lg: "text-sm px-3.5 py-1.5 font-semibold rounded-full",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 border transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  );
}
