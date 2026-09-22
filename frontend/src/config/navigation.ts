import {
  BedDouble,
  BookOpenText,
  ChartNoAxesCombined,
  ClipboardPlus,
  ContactRound,
  LayoutGrid,
  RadioTower,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navigationGroups: { label: string; items: NavigationItem[] }[] = [
  {
    label: "Hôm nay",
    items: [
      { href: "/operations", label: "Vận hành phòng", icon: LayoutGrid },
      { href: "/bookings", label: "Đặt / nhận phòng", icon: ClipboardPlus },
      { href: "/ledger", label: "Sổ đặt phòng", icon: BookOpenText },
    ],
  },
  {
    label: "Quản lý",
    items: [
      { href: "/rooms", label: "Phòng", icon: BedDouble },
      { href: "/customers", label: "Khách hàng", icon: ContactRound },
      { href: "/channels", label: "Kênh đặt phòng", icon: RadioTower },
    ],
  },
  {
    label: "Theo dõi",
    items: [
      { href: "/invoices", label: "Hóa đơn", icon: ReceiptText },
      { href: "/dashboard", label: "Báo cáo quản trị", icon: ChartNoAxesCombined },
    ],
  },
];

export const navigationItems = navigationGroups.flatMap((group) => group.items);
