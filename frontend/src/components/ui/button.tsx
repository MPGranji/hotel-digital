import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "default" | "sm";
}

const variants: Record<ButtonVariant, string> = {
  primary: "border-[var(--primary)] bg-[var(--primary)] font-semibold text-white hover:bg-[var(--primary-strong)]",
  secondary: "border-[var(--border-strong)] bg-white text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
  danger: "border-[#dfc0b9] bg-white text-[#8c493e] hover:bg-[#f9efec]",
  ghost: "border-transparent bg-transparent text-[var(--nav-text)] hover:bg-[var(--surface-muted)]",
};

export function Button({ className = "", variant = "primary", size = "default", type = "button", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-[background-color,border-color,transform] duration-150 active:translate-y-px ${size === "sm" ? "min-h-11 px-3 py-1.5 sm:min-h-9" : "min-h-10 px-4 py-2"} ${variants[variant]} ${className}`}
      type={type}
      {...props}
    />
  );
}
