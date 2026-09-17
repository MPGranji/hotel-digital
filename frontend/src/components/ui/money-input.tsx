import { Input } from "@/components/ui/field";

const moneyFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

export function MoneyInput({ id, value, disabled, onChange }: Readonly<{ id: string; value: string; disabled?: boolean; onChange: (value: string) => void }>) {
  const number = Number(value);
  const displayValue = value === "" || !Number.isFinite(number) ? "" : moneyFormatter.format(number);

  return (
    <div className="relative">
      <Input
        autoComplete="off"
        className="pr-10 text-right font-medium tabular-nums"
        disabled={disabled}
        id={id}
        inputMode="numeric"
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "");
          onChange(digits ? digits.replace(/^0+(?=\d)/, "") : "");
        }}
        placeholder="0"
        type="text"
        value={displayValue}
      />
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-slate-500">đ</span>
    </div>
  );
}
