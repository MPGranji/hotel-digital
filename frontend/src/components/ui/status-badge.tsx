import { bookingStatusLabels } from "@/lib/format";

const styles: Record<string, string> = {
  BOOKED: "border-[#d8c6a7] bg-[#faf4e9] text-[#755b2e]",
  CHECKED_IN: "border-[#bdd1cb] bg-[#edf5f2] text-[#24544d]",
  CHECKED_OUT: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--nav-text)]",
  CANCELLED: "border-[#dfc0b9] bg-[#f9efec] text-[#8c493e]",
  NO_SHOW: "border-[#d8c6a7] bg-[#faf4e9] text-[#755b2e]",
};

export function StatusBadge({ status }: Readonly<{ status: string }>) {
  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${styles[status] ?? styles.BOOKED}`}>
      {bookingStatusLabels[status] ?? status}
    </span>
  );
}
