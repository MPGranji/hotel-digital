import type { BookingFormState } from "./booking-form-state";
import type { BookingOptions } from "./types";

const channelRateCodes: Record<string, string> = {
  FACEBOOK: "FANPAGE",
  A26_WEB: "FANPAGE",
  EXPEDIA: "EXPEDIA",
  AGODA: "AGODA",
  TRAVELOKA: "TRAVELOKA",
  BOOKING: "BOOKING",
};

export function calculateSuggestedRoomRevenue(form: BookingFormState, options: BookingOptions) {
  const room = options.rooms.find((item) => String(item.id) === form.roomId);
  const channel = options.channels.find((item) => String(item.id) === form.channelId);
  const checkIn = new Date(form.checkInAt);
  const nights = Number(form.billedNights);

  if (!room || !channel || Number.isNaN(checkIn.getTime()) || !Number.isInteger(nights) || nights < 1) {
    return undefined;
  }

  const rateCode = channelRateCodes[channel.code.toUpperCase()] ?? "NET";
  const rate = room.rates.find((item) => item.code === rateCode)
    ?? room.rates.find((item) => item.code === "NET");
  if (!rate) return undefined;

  let total = 0;
  const night = new Date(checkIn);
  for (let index = 0; index < nights; index += 1) {
    const day = night.getDay();
    total += day === 0 || day === 5 || day === 6 ? rate.weekendPrice : rate.weekdayPrice;
    night.setDate(night.getDate() + 1);
  }
  return total;
}
