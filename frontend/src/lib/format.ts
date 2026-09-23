const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 2,
});

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

const dateFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const hotelDateTimeParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function asHotelInstant(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00+07:00`);
  return new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}+07:00`);
}

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatDateTime(value?: string | null) {
  return value ? dateTimeFormatter.format(asHotelInstant(value)) : "Chưa có";
}

export function formatDate(value?: string | null) {
  return value ? dateFormatter.format(asHotelInstant(value)) : "Chưa có";
}

export function formatUtcDateTime(value?: string | null) {
  if (!value) return "Chưa có";
  return dateTimeFormatter.format(new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`));
}

export const bookingStatusLabels: Record<string, string> = {
  BOOKED: "Đã đặt",
  CHECKED_IN: "Đang lưu trú",
  CHECKED_OUT: "Đã trả phòng",
  CANCELLED: "Đã hủy",
  NO_SHOW: "Không đến",
};

export function toDateTimeLocal(value: Date | string) {
  if (typeof value === "string" && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return value.slice(0, 16);
  const parts = hotelDateTimeParts.formatToParts(typeof value === "string" ? new Date(value) : value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function hotelToday() {
  return toDateTimeLocal(new Date()).slice(0, 10);
}

export function addHotelDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
