import { Button } from "./button";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Phân trang" className="flex items-center justify-end gap-2">
      <Button disabled={page <= 1} onClick={() => onPageChange(page - 1)} variant="secondary">
        Trước
      </Button>
      <span className="px-2 text-sm text-slate-600">Trang {page}/{totalPages}</span>
      <Button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} variant="secondary">
        Sau
      </Button>
    </nav>
  );
}
