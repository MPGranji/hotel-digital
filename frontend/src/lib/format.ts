const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" });

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatDateTime(value?: string | null) {
  return value ? dateTimeFormatter.format(new Date(value)) : "Chưa có";
}

export function formatDate(value?: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "Chưa có";
}

export const bookingStatusLabels: Record<string, string> = {
  BOOKED: "Đã đặt",
  CHECKED_IN: "Đang lưu trú",
  CHECKED_OUT: "Đã trả phòng",
  CANCELLED: "Đã hủy",
  NO_SHOW: "Không đến",
};

export function toDateTimeLocal(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
