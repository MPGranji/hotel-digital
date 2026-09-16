"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { getApiErrorMessage, getApiProblem } from "@/lib/api-client";
import { createCustomer, getCustomer, updateCustomer } from "./customers-api";
import type { CustomerDetail, CustomerWriteRequest } from "./types";

interface CustomerEditorProps {
  customerId?: number;
  onClose: () => void;
  onSaved: (customer: CustomerDetail) => void;
}

const emptyForm: CustomerWriteRequest = {
  fullName: "",
  phone: "",
  email: "",
  identityDocument: "",
  nationality: "",
  note: "",
  version: null,
};

export function CustomerEditor({ customerId, onClose, onSaved }: CustomerEditorProps) {
  const [form, setForm] = useState<CustomerWriteRequest>(emptyForm);
  const [loading, setLoading] = useState(Boolean(customerId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!customerId) return;
    let active = true;
    void getCustomer(customerId)
      .then((customer) => {
        if (!active) return;
        setForm({
          fullName: customer.fullName,
          phone: customer.phone ?? "",
          email: customer.email ?? "",
          identityDocument: customer.identityDocument ?? "",
          nationality: customer.nationality ?? "",
          note: customer.note ?? "",
          version: customer.version,
        });
      })
      .catch((reason) => setError(getApiErrorMessage(reason, "Không thể tải hồ sơ khách hàng.")))
      .finally(() => setLoading(false));
    return () => { active = false; };
  }, [customerId]);

  function update(field: keyof CustomerWriteRequest, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save() {
    setSaving(true);
    setError(undefined);
    setFieldErrors({});
    try {
      const customer = customerId
        ? await updateCustomer(customerId, form)
        : await createCustomer(form);
      onSaved(customer);
    } catch (reason) {
      setFieldErrors(getApiProblem(reason)?.errors ?? {});
      setError(getApiErrorMessage(reason, "Không thể lưu hồ sơ khách hàng."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div aria-labelledby="customer-editor-title" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog">
      <form className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950" id="customer-editor-title">{customerId ? "Cập nhật khách hàng" : "Thêm khách hàng"}</h2>
            <p className="mt-1 text-sm text-slate-500">Chỉ họ và tên là bắt buộc.</p>
          </div>
          <Button onClick={onClose} variant="ghost">Đóng</Button>
        </div>
        {error ? <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p> : null}
        {loading ? <p className="py-10 text-center text-sm text-slate-500">Đang tải hồ sơ…</p> : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field error={fieldErrors.fullName?.[0]} htmlFor="editFullName" label="Họ và tên" required>
              <Input autoFocus id="editFullName" onChange={(event) => update("fullName", event.target.value)} value={form.fullName} />
            </Field>
            <Field error={fieldErrors.phone?.[0]} htmlFor="editPhone" label="Số điện thoại">
              <Input id="editPhone" onChange={(event) => update("phone", event.target.value)} value={form.phone} />
            </Field>
            <Field error={fieldErrors.email?.[0]} htmlFor="editEmail" label="Email">
              <Input id="editEmail" onChange={(event) => update("email", event.target.value)} type="email" value={form.email} />
            </Field>
            <Field error={fieldErrors.identityDocument?.[0]} htmlFor="editIdentity" label="CCCD/Passport">
              <Input id="editIdentity" onChange={(event) => update("identityDocument", event.target.value)} value={form.identityDocument} />
            </Field>
            <Field error={fieldErrors.nationality?.[0]} htmlFor="editNationality" label="Quốc tịch">
              <Input id="editNationality" onChange={(event) => update("nationality", event.target.value)} value={form.nationality} />
            </Field>
            <Field error={fieldErrors.note?.[0]} htmlFor="editCustomerNote" label="Ghi chú">
              <Textarea id="editCustomerNote" onChange={(event) => update("note", event.target.value)} value={form.note} />
            </Field>
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button onClick={onClose} variant="secondary">Hủy</Button>
          <Button disabled={loading || saving} type="submit">{saving ? "Đang lưu…" : "Lưu khách hàng"}</Button>
        </div>
      </form>
    </div>
  );
}
