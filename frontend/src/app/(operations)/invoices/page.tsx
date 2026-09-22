import { InvoiceDirectory } from "@/features/invoices/invoice-directory";

export default async function InvoicesPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ invoiceId?: string }> }>) {
  const params = await searchParams;
  const invoiceId = Number(params.invoiceId);
  return <InvoiceDirectory initialInvoiceId={Number.isInteger(invoiceId) && invoiceId > 0 ? invoiceId : undefined} />;
}
