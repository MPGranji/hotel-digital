import {
  BedDouble,
  BookOpenText,
  ClipboardPlus,
  ContactRound,
  RadioTower,
  type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navigationItems: NavigationItem[] = [
  { href: "/bookings", label: "Đặt phòng & Check-in", icon: ClipboardPlus },
  { href: "/ledger", label: "Sổ đặt phòng", icon: BookOpenText },
  { href: "/rooms", label: "Phòng", icon: BedDouble },
  { href: "/customers", label: "Khách hàng", icon: ContactRound },
  { href: "/channels", label: "Kênh đặt phòng", icon: RadioTower },
];
