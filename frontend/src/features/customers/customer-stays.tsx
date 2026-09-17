"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getCustomerStays } from "./customers-api";
import type { CustomerStay } from "./types";

export function CustomerStays({ customerId, customerName, onClose }: Readonly<{ customerId: number; customerName: string; onClose: () => void }>) {
  const [stays, setStays] = useState<CustomerStay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void getCustomerStays(customerId)
      .then((result) => { if (active) setStays(result); })
      .finally(() => setLoading(false));
    return () => { active = false; };
  }, [customerId]);

  return (
    <div aria-labelledby="customer-stays-title" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog">
      <section className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950" id="customer-stays-title">Lịch sử lưu trú</h2>
            <p className="mt-1 text-sm text-slate-500">{customerName}</p>
          </div>
          <Button onClick={onClose} variant="ghost">Đóng</Button>
        </div>
        {loading ? <p className="py-10 text-center text-sm text-slate-500">Đang tải lịch sử…</p> : stays.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">Khách hàng chưa có lượt lưu trú.</p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Mã</th><th className="px-3 py-3">Phòng</th><th className="px-3 py-3">Thời gian</th><th className="px-3 py-3">Doanh thu</th><th className="px-3 py-3">Trạng thái</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {stays.map((stay) => <tr key={stay.bookingId}><td className="px-3 py-3 font-medium text-[var(--primary)]">{stay.bookingCode}</td><td className="px-3 py-3">{stay.roomNumber}</td><td className="px-3 py-3">{formatDateTime(stay.checkInAt)} – {formatDateTime(stay.checkOutAt)}</td><td className="px-3 py-3 text-right font-medium">{formatCurrency(stay.grossRevenue)}</td><td className="px-3 py-3"><StatusBadge status={stay.status} /></td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
