import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  isLoading = false,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-medium transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]";

  const variantStyles = {
    primary:
      "bg-[#0D7C7A] text-white hover:bg-[#0A6361] shadow-sm hover:shadow-md border border-teal-700/20",
    secondary:
      "bg-[#0B192C] text-white hover:bg-[#152238] shadow-sm hover:shadow-md",
    outline:
      "bg-white/80 hover:bg-white text-[#152238] border border-black/[0.12] hover:border-[#0D7C7A]/40 shadow-xs",
    danger:
      "bg-[#BE123C] text-white hover:bg-[#9F1239] shadow-sm hover:shadow-md border border-rose-800/20",
    ghost:
      "bg-transparent text-[#4A5B72] hover:text-[#0B192C] hover:bg-black/[0.04]",
  };

  const sizeStyles = {
    sm: "text-xs px-3 py-1.5 rounded-lg gap-1.5",
    md: "text-sm px-4 py-2.5 rounded-xl gap-2",
    lg: "text-base px-6 py-3.5 rounded-2xl gap-2.5 font-semibold",
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
}
