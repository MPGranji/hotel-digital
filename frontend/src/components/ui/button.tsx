import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variants: Record<ButtonVariant, string> = {
  primary: "border-[var(--primary)] bg-[var(--primary)] text-white hover:bg-[var(--primary-strong)]",
  secondary: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  danger: "border-red-200 bg-white text-red-700 hover:bg-red-50",
  ghost: "border-transparent bg-transparent text-slate-600 hover:bg-slate-100",
};

export function Button({ className = "", variant = "primary", type = "button", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 ${variants[variant]} ${className}`}
      type={type}
      {...props}
    />
  );
}
