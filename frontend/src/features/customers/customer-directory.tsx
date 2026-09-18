"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { DataMessage, PageHeader, Panel } from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { PagedResult } from "@/types/api";
import { CustomerEditor } from "./customer-editor";
import { getCustomer, getCustomers, updateCustomer } from "./customers-api";
import { CustomerStays } from "./customer-stays";
import type { CustomerListItem } from "./types";

export function CustomerDirectory() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("true");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<PagedResult<CustomerListItem>>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [editingId, setEditingId] = useState<number | "new">();
  const [staysFor, setStaysFor] = useState<CustomerListItem>();
  const [updatingId, setUpdatingId] = useState<number>();

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let mounted = true;
    void getCustomers(search, page, 20, active)
      .then((data) => { if (mounted) setResult(data); })
      .catch((reason) => setError(getApiErrorMessage(reason, "Không thể tải danh sách khách hàng.")))
      .finally(() => setLoading(false));
    return () => { mounted = false; };
  }, [active, page, reloadKey, search]);

  function refresh() {
    setLoading(true);
    setError(undefined);
    setReloadKey((value) => value + 1);
  }

  async function toggleCustomer(customer: CustomerListItem) {
    const action = customer.isActive ? "ngừng sử dụng" : "kích hoạt lại";
    if (!window.confirm(`Xác nhận ${action} hồ sơ ${customer.fullName}? Booking và lịch sử lưu trú vẫn được giữ nguyên.`)) return;
    setUpdatingId(customer.id);
    setError(undefined);
    try {
      const detail = await getCustomer(customer.id);
      await updateCustomer(customer.id, {
        fullName: detail.fullName,
        phone: detail.phone ?? "",
        email: detail.email ?? "",
        identityDocument: detail.identityDocument ?? "",
        nationality: detail.nationality ?? "",
        note: detail.note ?? "",
        isActive: !detail.isActive,
        version: detail.version,
      });
      refresh();
    } catch (reason) {
      setError(getApiErrorMessage(reason, `Không thể ${action} hồ sơ khách hàng.`));
    } finally {
      setUpdatingId(undefined);
    }
  }

  return (
    <>
      <PageHeader
        actions={<Button onClick={() => setEditingId("new")}>Thêm khách hàng</Button>}
        description="Tra cứu hồ sơ khách và lần check-in gần nhất. Hệ thống không tự gộp khách chỉ vì trùng một trường."
        title="Khách hàng"
      />
      <Panel>
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
          <Input aria-label="Tìm khách hàng" className="sm:max-w-md" onChange={(event) => { setQuery(event.target.value); setPage(1); setLoading(true); }} placeholder="Tìm tên, số điện thoại hoặc CCCD/Passport" value={query} />
          <Select aria-label="Trạng thái khách" className="sm:max-w-xs" onChange={(event) => { setActive(event.target.value); setPage(1); setLoading(true); }} value={active}><option value="true">Đang sử dụng</option><option value="false">Đã ngừng dùng / đã gộp</option><option value="">Tất cả trạng thái</option></Select>
          <Button className="sm:ml-auto" onClick={refresh} variant="secondary">Làm mới</Button>
        </div>
        {error ? <DataMessage action={<Button onClick={refresh}>Thử lại</Button>} description={error} title="Không thể tải dữ liệu" /> : loading ? (
          <DataMessage title="Đang tải danh sách khách hàng…" />
        ) : !result?.items.length ? (
          <DataMessage description="Thử thay đổi từ khóa hoặc thêm hồ sơ mới." title="Chưa có khách hàng phù hợp" />
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Khách hàng</th><th className="px-3 py-3">Liên hệ</th><th className="px-3 py-3">CCCD/Passport</th><th className="px-3 py-3">Quốc tịch</th><th className="px-3 py-3">Check-in gần nhất</th><th className="px-3 py-3 text-right">Thao tác</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {result.items.map((customer) => (
                    <tr className="hover:bg-slate-50" key={customer.id}>
                      <td className="px-3 py-3"><p className="font-medium text-slate-900">{customer.fullName}</p><p className="text-xs text-slate-500">ID {customer.id} · {customer.stayCount} lượt lưu trú · {customer.isActive ? "Đang dùng" : "Ngừng dùng"}</p></td>
                      <td className="px-3 py-3"><p>{customer.phone || "—"}</p><p className="text-xs text-slate-500">{customer.email || ""}</p></td>
                      <td className="px-3 py-3">{customer.identityDocument || "—"}</td>
                      <td className="px-3 py-3">{customer.nationality || "Chưa xác định"}</td>
                      <td className="px-3 py-3">{formatDate(customer.lastCheckInAt)}</td>
                      <td className="px-3 py-3"><div className="flex justify-end gap-2"><Button onClick={() => setStaysFor(customer)} variant="info">Lịch sử</Button><Button onClick={() => setEditingId(customer.id)} variant="warning">Sửa</Button><Button disabled={updatingId === customer.id} onClick={() => void toggleCustomer(customer)} variant={customer.isActive ? "danger" : "secondary"}>{updatingId === customer.id ? "Đang lưu…" : customer.isActive ? "Ngừng dùng" : "Kích hoạt"}</Button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">{result.totalItems.toLocaleString("vi-VN")} khách hàng</p>
              <Pagination page={result.page} totalPages={result.totalPages} onPageChange={(next) => { setPage(next); setLoading(true); }} />
            </div>
          </>
        )}
      </Panel>
      {editingId ? <CustomerEditor customerId={editingId === "new" ? undefined : editingId} onClose={() => setEditingId(undefined)} onSaved={() => { setEditingId(undefined); refresh(); }} /> : null}
      {staysFor ? <CustomerStays customerId={staysFor.id} customerName={staysFor.fullName} onClose={() => setStaysFor(undefined)} /> : null}
    </>
  );
}
