import { Field, Input, Textarea } from "@/components/ui/field";
import { SectionTitle } from "@/components/ui/page";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { countryOptions } from "./country-options";
import type { useBookingForm } from "./use-booking-form";

type FormModel = ReturnType<typeof useBookingForm>;

export function CustomerSection({ model, disabled }: Readonly<{ model: FormModel; disabled: boolean }>) {
  const { form, customers, duplicateCustomers, customerSearch, customerSearchError, checkingCustomerSearch, fieldErrors, setCustomerSearch, retryCustomerSearch, chooseDuplicateCustomer, confirmNewCustomer, updateField } = model;

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
        <div className="max-w-2xl">
          <Field error={fieldErrors.customerId?.[0]} htmlFor="customerId" label="Khách hàng" required>
            <SearchableSelect
              disabled={disabled}
              emptyText={checkingCustomerSearch ? "Đang tìm khách…" : customerSearchError ? "Chưa tải được khách hàng." : "Không tìm thấy khách phù hợp."}
              id="customerId"
              onChange={(value) => {
                const customer = customers.find((item) => String(item.id) === value);
                updateField("customerId", value);
                if (customer) updateField("customerName", customer.fullName);
              }}
              onSearchChange={setCustomerSearch}
              options={[
                ...(form.customerId && !customers.some((customer) => String(customer.id) === form.customerId)
                  ? [{ value: form.customerId, label: form.customerName }]
                  : []),
                ...customers.map((customer) => ({
                  value: String(customer.id),
                  label: `${customer.fullName}${customer.phone ? ` · ${customer.phone}` : ""}`,
                  inputValue: customer.fullName,
                  searchText: `${customer.email ?? ""} ${customer.identityDocument ?? ""}`,
                })),
              ]}
              placeholder="Chọn khách hàng"
              searchPlaceholder="Nhập tên, SĐT hoặc số giấy tờ…"
              searchValue={customerSearch}
              value={form.customerId}
            />
          </Field>
          {customerSearchError ? <p className="mt-2 text-sm text-[#8c493e]" role="alert">{customerSearchError} <button className="font-semibold underline" onClick={retryCustomerSearch} type="button">Thử lại</button></p> : null}
        </div>
      ) : (<>
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
          <Field error={fieldErrors["newCustomer.identityDocument"]?.[0]} htmlFor="identityDocument" label="CCCD / Hộ chiếu">
            <Input disabled={disabled} id="identityDocument" onChange={(event) => updateField("identityDocument", event.target.value)} value={form.identityDocument} />
          </Field>
          <Field error={fieldErrors["newCustomer.nationality"]?.[0]} htmlFor="nationality" label="Quốc tịch">
            <SearchableSelect
              disabled={disabled}
              emptyText="Không tìm thấy quốc gia phù hợp."
              id="nationality"
              onChange={(value) => updateField("nationality", value)}
              options={countryOptions}
              placeholder="Chọn quốc tịch"
              searchPlaceholder="Nhập tên tiếng Anh hoặc mã quốc gia…"
              value={form.nationality}
            />
          </Field>
          <Field error={fieldErrors["newCustomer.note"]?.[0]} htmlFor="customerNote" label="Ghi chú khách hàng">
            <Textarea className="min-h-10" disabled={disabled} id="customerNote" onChange={(event) => updateField("customerNote", event.target.value)} rows={1} value={form.customerNote} />
          </Field>
        </div>
        {duplicateCustomers.length ? <div className="mt-4 rounded-lg border border-[#d8c6a7] bg-[#faf4e9] p-4" role="status"><p className="font-semibold text-[#755b2e]">Có thể khách này đã có hồ sơ</p><p className="mt-1 text-sm text-[#755b2e]">Dùng hồ sơ cũ hoặc xác nhận đây là khách khác trước khi lưu.</p><div className="mt-2 grid gap-2 md:grid-cols-2">{duplicateCustomers.map((customer) => <div className="rounded-md bg-white p-3 text-sm" key={customer.id}><b>{customer.fullName}</b> · ID {customer.id}<p className="text-xs text-[var(--muted)]">{customer.phone || "Chưa có SĐT"} · {customer.identityDocument || "Chưa có giấy tờ"}</p><p className="mt-1 text-xs text-[#755b2e]">Thông tin giống: {customer.matchedFields.join(", ")}</p><button className="mt-2 font-semibold text-[var(--primary)] underline" onClick={() => chooseDuplicateCustomer(customer)} type="button">Dùng hồ sơ này</button></div>)}</div><button className="mt-3 text-sm font-semibold text-[#755b2e] underline" onClick={confirmNewCustomer} type="button">Đây là khách khác, tạo hồ sơ mới</button></div> : null}
      </>)}
      <p className="mt-3 text-xs text-slate-500">Số điện thoại, email và giấy tờ không bắt buộc. Hệ thống không tự gộp hồ sơ khách.</p>
    </div>
  );
}
