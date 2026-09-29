import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { formatCurrency } from "@/lib/format";
import { chargeKindLabel, chargeSuggestions, chargeUnitPrice, splitNote, type ChargeKind } from "./charge-notes";
import type { ChargeEditTarget, useBookingForm } from "./use-booking-form";

type FormModel = ReturnType<typeof useBookingForm>;

const kindBadge: Record<ChargeKind, string> = {
  serviceRevenue: "bg-[var(--nav-active)] text-[var(--primary-strong)]",
  surchargeAmount: "bg-amber-100 text-amber-800",
};

/** Itemised services and surcharges; their sum is what the booking stores as the service/surcharge totals. */
export function ChargesPanel({ model, disabled }: Readonly<{ model: FormModel; disabled: boolean }>) {
  const { form, booking } = model;
  const [kind, setKind] = useState<ChargeKind>("serviceRevenue");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [error, setError] = useState("");
  const [target, setTarget] = useState<ChargeEditTarget>();

  const charges = splitNote(form.note).charges;
  // Part of each total that has no itemised line (typed straight into the total before, or imported).
  const unlisted = (["serviceRevenue", "surchargeAmount"] as const)
    .map((item) => ({ kind: item, amount: (Number(form[item]) || 0) - charges.filter((charge) => charge.kind === item).reduce((sum, charge) => sum + charge.amount, 0) }))
    .filter(({ amount }) => amount > 0);
  const lineTotal = (Number(quantity) || 0) * (Number(unitPrice) || 0);
  const editingIndex = target && "index" in target ? target.index : undefined;
  const editingUnlisted = target && "unlisted" in target ? target.unlisted : undefined;

  function save() {
    const saveError = model.recordAdditionalCharge(kind, quantity, unitPrice, description, target);
    if (saveError) {
      setError(saveError);
      return;
    }
    reset();
  }

  function reset() {
    setTarget(undefined);
    setDescription("");
    setQuantity("1");
    setUnitPrice("");
    setError("");
  }

  function startEdit(index: number) {
    const charge = charges[index];
    setTarget({ index });
    setKind(charge.kind);
    setDescription(charge.description);
    setQuantity(String(charge.quantity));
    setUnitPrice(String(chargeUnitPrice(charge)));
    setError("");
  }

  function startDescribeUnlisted(item: ChargeKind, amount: number) {
    setTarget({ unlisted: item, amount });
    setKind(item);
    setDescription("");
    setQuantity("1");
    setUnitPrice(String(amount));
    setError("");
  }

  function remove(index: number) {
    model.removeAdditionalCharge(index);
    if (editingIndex === index) reset();
    else if (editingIndex !== undefined && editingIndex > index) setTarget({ index: editingIndex - 1 });
  }

  function removeUnlisted(item: ChargeKind) {
    model.removeUnlistedCharge(item);
    if (editingUnlisted === item) reset();
  }

  const totals = { serviceRevenue: Number(form.serviceRevenue) || 0, surchargeAmount: Number(form.surchargeAmount) || 0 };

  return (
    <div className="mt-5 rounded-xl border border-[var(--border)] bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-[var(--foreground)]">Dịch vụ và phụ thu</h3>
        <p className="text-sm text-[var(--muted)]">Dịch vụ <b className="tabular-nums text-[var(--foreground)]">{formatCurrency(totals.serviceRevenue)}</b> · Phụ thu <b className="tabular-nums text-[var(--foreground)]">{formatCurrency(totals.surchargeAmount)}</b></p>
      </div>
      {!booking && form.roomMode === "multiple" ? <p className="mt-1 text-xs text-[var(--muted)]">Các khoản này được tính cho mỗi phòng trong nhóm.</p> : null}

      {charges.length > 0 || unlisted.length > 0 ? <ul className="mt-3 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] text-sm">
        {charges.map((charge, index) => <li className={`flex items-center gap-3 px-3 py-2 ${editingIndex === index ? "bg-[var(--nav-active)]" : ""}`} key={`${index}-${charge.description}`}>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${kindBadge[charge.kind]}`}>{chargeKindLabel(charge.kind)}</span>
          <span className="min-w-0 flex-1 break-words">
            {charge.description}
            {charge.quantity > 1 ? <span className="text-[var(--muted)]"> · {charge.quantity} × {formatCurrency(chargeUnitPrice(charge))}</span> : null}
          </span>
          <strong className="tabular-nums">{formatCurrency(charge.amount)}</strong>
          {!disabled ? <RowActions label={charge.description} onEdit={() => startEdit(index)} onRemove={() => remove(index)} /> : null}
        </li>)}
        {unlisted.map(({ kind: item, amount }) => <li className={`flex items-center gap-3 px-3 py-2 text-[var(--muted)] ${editingUnlisted === item ? "bg-[var(--nav-active)]" : ""}`} key={`unlisted-${item}`}>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold">{chargeKindLabel(item)}</span>
          <span className="flex-1 italic">Chưa có mô tả</span>
          <strong className="tabular-nums">{formatCurrency(amount)}</strong>
          {!disabled ? <RowActions label={`${chargeKindLabel(item)} chưa có mô tả`} onEdit={() => startDescribeUnlisted(item, amount)} onRemove={() => removeUnlisted(item)} /> : null}
        </li>)}
      </ul> : <p className="mt-3 text-sm text-[var(--muted)]">Chưa có khoản nào.</p>}

      {!disabled ? <>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(120px,0.7fr)_minmax(180px,1.6fr)_90px_minmax(130px,0.9fr)_auto] lg:items-end">
          <Field htmlFor="chargeKind" label="Loại khoản">
            <Select id="chargeKind" onChange={(event) => setKind(event.target.value as ChargeKind)} value={kind}>
              <option value="serviceRevenue">Dịch vụ</option>
              <option value="surchargeAmount">Phụ thu</option>
            </Select>
          </Field>
          <Field htmlFor="chargeDescription" label="Nội dung">
            <SearchableSelect
              createOptionLabel={(query) => `Thêm “${query}”`}
              id="chargeDescription"
              onChange={(value) => { if (value) setDescription(value); }}
              onSearchChange={(value) => setDescription(value.slice(0, 120))}
              options={chargeSuggestions[kind].map((item) => ({ value: item, label: item }))}
              placeholder="Chọn nội dung"
              searchPlaceholder={kind === "serviceRevenue" ? "Giặt ủi, minibar…" : "Nhận phòng sớm, thêm người…"}
              searchValue={description}
              value={description}
            />
          </Field>
          <Field htmlFor="chargeQuantity" label="Số lượng">
            <Input id="chargeQuantity" inputMode="numeric" max={999} min={1} onChange={(event) => setQuantity(event.target.value.replace(/\D/g, "").slice(0, 3))} value={quantity} />
          </Field>
          <Field htmlFor="chargeUnitPrice" label="Đơn giá">
            <MoneyInput id="chargeUnitPrice" onChange={setUnitPrice} value={unitPrice} />
          </Field>
          <div className="flex gap-2">
            <Button onClick={save}>{target ? "Cập nhật" : "Thêm"}</Button>
            {target ? <Button onClick={reset} variant="secondary">Hủy</Button> : null}
          </div>
        </div>
        {lineTotal > 0 && Number(quantity) > 1 ? <p className="mt-2 text-sm text-[var(--muted)]">Thành tiền: <b className="text-[var(--foreground)]">{formatCurrency(lineTotal)}</b></p> : null}
        {error ? <p className="mt-2 text-sm text-[var(--danger)]" role="alert">{error}</p> : null}
        {booking && booking.status !== "CHECKED_IN" && model.hasUnsavedChanges ? <div className="mt-3 flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border)] pt-3">
          <span className="text-sm text-[var(--muted)]">Có thay đổi chưa lưu.</span>
          <Button disabled={!model.canSave || model.summary.balance < 0} onClick={() => void model.submit()}>{model.saving ? "Đang lưu…" : "Lưu thay đổi"}</Button>
        </div> : null}
      </> : null}
    </div>
  );
}

function RowActions({ label, onEdit, onRemove }: Readonly<{ label: string; onEdit: () => void; onRemove: () => void }>) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button aria-label={`Sửa ${label}`} className="min-h-8 px-2" onClick={onEdit} size="sm" variant="secondary"><Pencil className="size-4" /></Button>
      <Button aria-label={`Xóa ${label}`} className="min-h-8 px-2" onClick={onRemove} size="sm" variant="secondary"><X className="size-4" /></Button>
    </div>
  );
}
