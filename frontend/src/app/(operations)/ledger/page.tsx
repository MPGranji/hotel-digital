import { LedgerScreen, type LedgerFilters } from "@/features/ledger/ledger-screen";

export default async function LedgerPage({ searchParams }: Readonly<{ searchParams: Promise<Partial<LedgerFilters>> }>) {
  const params = await searchParams;
  const initialFilters: LedgerFilters = {
    search: params.search ?? "",
    dateFrom: params.dateFrom ?? "",
    dateTo: params.dateTo ?? "",
    roomId: params.roomId ?? "",
    channelId: params.channelId ?? "",
    status: params.status ?? "",
  };
  return <LedgerScreen initialFilters={initialFilters} />;
}
