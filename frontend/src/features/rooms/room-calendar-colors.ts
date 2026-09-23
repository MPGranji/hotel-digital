export const calendarStatus = {
  AVAILABLE: {
    cell: "bg-[#f5f7f8] text-[#536770]",
    dot: "bg-[#82939b]",
  },
  BOOKED: {
    cell: "bg-[#faf4e9] text-[#755b2e] hover:bg-[#f4ead7]",
    dot: "bg-[#b08d57]",
  },
  CHECKED_IN: {
    cell: "bg-[#edf4ed] text-[#365c42] hover:bg-[#e2eee2]",
    dot: "bg-[#5f8d7a]",
  },
  CHECKED_OUT: {
    cell: "bg-[#eef1f5] text-[#4e6075] hover:bg-[#e5eaf0]",
    dot: "bg-[#7d90a5]",
  },
  MAINTENANCE: {
    cell: "bg-[#f9efec] text-[#8c493e]",
    dot: "bg-[#b85c4a]",
  },
  INACTIVE: {
    cell: "bg-[var(--surface-muted)] text-[var(--muted)]",
    dot: "bg-[#a5aaa5]",
  },
} as const;

const bookingAccents = [
  "#497e98", "#816c9a", "#8a7054", "#4f8980",
  "#946a79", "#688256", "#6477a1", "#9a7652",
] as const;

// A booking keeps its accent across rooms, dates, and both calendar views.
export function bookingAccent(bookingId: number) {
  return bookingAccents[Math.abs(bookingId) % bookingAccents.length];
}
