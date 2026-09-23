"use client";

import { useSyncExternalStore } from "react";
import { hotelToday } from "./format";

function subscribe(onChange: () => void) {
  const timer = window.setInterval(onChange, 60_000);
  window.addEventListener("focus", onChange);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("focus", onChange);
  };
}

export function useHotelToday() {
  return useSyncExternalStore(subscribe, hotelToday, () => "");
}
