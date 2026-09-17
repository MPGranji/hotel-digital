import type { BookingFormState } from "./booking-form-state";
import type { BookingOptions } from "./types";

export function calculateSuggestedRoomRevenue(form: BookingFormState, options: BookingOptions) {
  const room = options.rooms.find((item) => String(item.id) === form.roomId);
  const channel = options.channels.find((item) => String(item.id) === form.channelId);
  const checkIn = new Date(form.checkInAt);
  const nights = Number(form.billedNights);

  const usesCounterRate = channel?.category === "DIRECT" || channel?.category === "INTERNAL";
  if (!room || !usesCounterRate || Number.isNaN(checkIn.getTime()) || !Number.isInteger(nights) || nights < 1) {
    return undefined;
  }

  let total = 0;
  const night = new Date(checkIn);
  for (let index = 0; index < nights; index += 1) {
    const date = localDate(night);
    const rate = findRate(room.rates, "NET", date);
    if (!rate) return undefined;
    total += priceForDay(rate, night.getDay());
    night.setDate(night.getDate() + 1);
  }
  return total;
}

function priceForDay(rate: BookingOptions["rooms"][number]["rates"][number], day: number) {
  if (day === 0) return rate.sundayPrice ?? rate.weekendPrice;
  if (day === 1) return rate.mondayPrice ?? rate.weekdayPrice;
  if (day === 2) return rate.tuesdayPrice ?? rate.weekdayPrice;
  if (day === 3) return rate.wednesdayPrice ?? rate.weekdayPrice;
  if (day === 4) return rate.thursdayPrice ?? rate.weekdayPrice;
  if (day === 5) return rate.fridayPrice ?? rate.weekendPrice;
  return rate.saturdayPrice ?? rate.weekendPrice;
}

function findRate(
  rates: BookingOptions["rooms"][number]["rates"],
  code: string,
  date: string,
) {
  return rates
    .filter((rate) => rate.code === code && (!rate.effectiveFrom || rate.effectiveFrom <= date) && (!rate.effectiveTo || rate.effectiveTo >= date))
    .sort((a, b) => (b.effectiveFrom ?? "").localeCompare(a.effectiveFrom ?? ""))[0];
}

function localDate(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}
