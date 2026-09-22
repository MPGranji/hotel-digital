import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "info" | "success" | "warning" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variants: Record<ButtonVariant, string> = {
  primary: "border-[var(--primary)] bg-[var(--primary)] text-white hover:bg-[var(--primary-strong)]",
  secondary: "border-[var(--border-strong)] bg-white text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
  info: "border-[#bdd1cb] bg-[#edf5f2] text-[#24544d] hover:bg-[#e1eee9]",
  success: "border-[#bdd1cb] bg-[#edf5f2] text-[#24544d] hover:bg-[#e1eee9]",
  warning: "border-[#d8c6a7] bg-[#faf4e9] text-[#755b2e] hover:bg-[#f3ead8]",
  danger: "border-[#dfc0b9] bg-white text-[#8c493e] hover:bg-[#f9efec]",
  ghost: "border-transparent bg-transparent text-[var(--nav-text)] hover:bg-[var(--surface-muted)]",
};

export function Button({ className = "", variant = "primary", type = "button", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-[background-color,border-color,transform] duration-150 active:translate-y-px ${variants[variant]} ${className}`}
      type={type}
      {...props}
    />
  );
}
