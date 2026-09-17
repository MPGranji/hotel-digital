import { bookingStatusLabels } from "@/lib/format";

const styles: Record<string, string> = {
  BOOKED: "border-blue-200 bg-blue-50 text-blue-700",
  CHECKED_IN: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CHECKED_OUT: "border-slate-200 bg-slate-100 text-slate-600",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
  NO_SHOW: "border-amber-200 bg-amber-50 text-amber-800",
};

export function StatusBadge({ status }: Readonly<{ status: string }>) {
  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${styles[status] ?? styles.BOOKED}`}>
      {bookingStatusLabels[status] ?? status}
    </span>
  );
}
