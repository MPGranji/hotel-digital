import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SectionTitle } from "@/components/ui/page";
import type { useBookingForm } from "./use-booking-form";

type FormModel = ReturnType<typeof useBookingForm>;

export function CustomerSection({ model, disabled }: Readonly<{ model: FormModel; disabled: boolean }>) {
  const { form, customers, customerSearch, fieldErrors, setCustomerSearch, updateField } = model;

  return (
    <div>
      <SectionTitle>2. Khách hàng</SectionTitle>
      <div className="mb-4 flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2">
          <input checked={form.customerMode === "existing"} disabled={disabled} name="customerMode" onChange={() => updateField("customerMode", "existing")} type="radio" />
          Chọn khách hiện có
        </label>
        <label className="flex items-center gap-2">
          <input checked={form.customerMode === "new"} disabled={disabled} name="customerMode" onChange={() => updateField("customerMode", "new")} type="radio" />
          Tạo khách mới
        </label>
      </div>

      {form.customerMode === "existing" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Field htmlFor="customerSearch" label="Tìm khách">
            <Input disabled={disabled} id="customerSearch" onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Tên, số điện thoại hoặc CCCD/Passport" value={customerSearch} />
          </Field>
          <Field error={fieldErrors.customerId?.[0]} htmlFor="customerId" label="Khách hàng" required>
            <Select disabled={disabled} id="customerId" onChange={(event) => updateField("customerId", event.target.value)} value={form.customerId}>
              <option value="">Chọn khách hàng</option>
              {form.customerId && !customers.some((customer) => String(customer.id) === form.customerId) ? (
                <option value={form.customerId}>{form.customerName}</option>
              ) : null}
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.fullName}{customer.phone ? ` · ${customer.phone}` : ""}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field error={fieldErrors["newCustomer.fullName"]?.[0]} htmlFor="fullName" label="Họ và tên" required>
            <Input disabled={disabled} id="fullName" onChange={(event) => updateField("fullName", event.target.value)} value={form.fullName} />
          </Field>
          <Field error={fieldErrors["newCustomer.phone"]?.[0]} htmlFor="phone" label="Số điện thoại">
            <Input disabled={disabled} id="phone" inputMode="tel" onChange={(event) => updateField("phone", event.target.value)} value={form.phone} />
          </Field>
          <Field error={fieldErrors["newCustomer.email"]?.[0]} htmlFor="email" label="Email">
            <Input disabled={disabled} id="email" onChange={(event) => updateField("email", event.target.value)} type="email" value={form.email} />
          </Field>
          <Field error={fieldErrors["newCustomer.identityDocument"]?.[0]} htmlFor="identityDocument" label="CCCD/Passport">
            <Input disabled={disabled} id="identityDocument" onChange={(event) => updateField("identityDocument", event.target.value)} value={form.identityDocument} />
          </Field>
          <Field error={fieldErrors["newCustomer.nationality"]?.[0]} htmlFor="nationality" label="Quốc tịch">
            <Input disabled={disabled} id="nationality" onChange={(event) => updateField("nationality", event.target.value)} value={form.nationality} />
          </Field>
          <Field error={fieldErrors["newCustomer.note"]?.[0]} htmlFor="customerNote" label="Ghi chú khách hàng">
            <Textarea className="min-h-10" disabled={disabled} id="customerNote" onChange={(event) => updateField("customerNote", event.target.value)} rows={1} value={form.customerNote} />
          </Field>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">Số điện thoại, email và giấy tờ không bắt buộc. Hệ thống không tự gộp hồ sơ khách.</p>
    </div>
  );
}
