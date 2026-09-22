import {
  BedDouble,
  BookOpenText,
  ChartNoAxesCombined,
  ClipboardPlus,
  ContactRound,
  RadioTower,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navigationItems: NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: ChartNoAxesCombined },
  { href: "/bookings", label: "Đặt / nhận phòng", icon: ClipboardPlus },
  { href: "/ledger", label: "Sổ đặt phòng", icon: BookOpenText },
  { href: "/rooms", label: "Phòng", icon: BedDouble },
  { href: "/customers", label: "Khách hàng", icon: ContactRound },
  { href: "/invoices", label: "Hóa đơn", icon: ReceiptText },
  { href: "/channels", label: "Kênh đặt phòng", icon: RadioTower },
];
