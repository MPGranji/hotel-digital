// Additional charges have no table of their own: each one is stored as a line in the booking note.
// These helpers keep those lines apart from the free-text note so the UI can show them separately.

export type ChargeKind = "serviceRevenue" | "surchargeAmount";
/** `amount` is the line total (quantity × unit price). */
export type ChargeLine = { kind: ChargeKind; description: string; quantity: number; amount: number };

const kindLabels: Record<ChargeKind, string> = { serviceRevenue: "Dịch vụ", surchargeAmount: "Phụ thu" };

/** Common items offered as suggestions; staff can still type anything else. */
export const chargeSuggestions: Record<ChargeKind, string[]> = {
  serviceRevenue: ["Giặt ủi", "Minibar", "Nước uống", "Ăn sáng", "Ăn uống tại nhà hàng", "Đưa đón sân bay", "Thuê xe máy", "Giữ hành lý", "In ấn / photo"],
  surchargeAmount: ["Nhận phòng sớm", "Trả phòng muộn", "Thêm người", "Thêm giường phụ", "Mang thú cưng", "Ngày lễ / Tết", "Hư hỏng đồ dùng", "Mất chìa khóa / thẻ phòng"],
};
// "Dịch vụ: Minibar × 3 (+60.000 đ)"; the "× n" part is omitted when the quantity is 1 (older lines never have it).
const chargeLinePattern = /^(Dịch vụ|Phụ thu): (.+?)(?: × (\d+))? \(\+([\d.,\s]+) ?đ\)$/;

export function chargeKindLabel(kind: ChargeKind) {
  return kindLabels[kind];
}

export function formatChargeLine(charge: ChargeLine) {
  const quantity = charge.quantity > 1 ? ` × ${charge.quantity}` : "";
  return `${kindLabels[charge.kind]}: ${charge.description}${quantity} (+${charge.amount.toLocaleString("vi-VN")} đ)`;
}

export function chargeUnitPrice(charge: ChargeLine) {
  return Math.round(charge.amount / Math.max(charge.quantity, 1));
}

export function splitNote(note: string): { text: string; charges: ChargeLine[] } {
  const textLines: string[] = [];
  const charges: ChargeLine[] = [];
  for (const line of note.split("\n")) {
    const match = chargeLinePattern.exec(line.trim());
    const amount = match ? Number(match[4].replace(/\D/g, "")) : 0;
    if (match && amount > 0) {
      charges.push({ kind: match[1] === "Dịch vụ" ? "serviceRevenue" : "surchargeAmount", description: match[2].trim(), quantity: Number(match[3]) || 1, amount });
    } else {
      textLines.push(line);
    }
  }
  return { text: textLines.join("\n"), charges };
}

export function joinNote(text: string, charges: ChargeLine[]) {
  // Keep the text as typed (no trim) so the textarea does not swallow trailing spaces or new lines.
  const chargeLines = charges.map(formatChargeLine);
  return text.trim() ? [text, ...chargeLines].join("\n") : chargeLines.join("\n");
}
