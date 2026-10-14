import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** "Showing 26–50 of 120" with previous/next buttons. Hidden when everything fits on one page. */
export function Pager({ page, pageSize, total, onPage, testId = "pager" }) {
  const pageCount = Math.ceil(total / pageSize);
  if (pageCount <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="icon" aria-label="Previous page" title="Previous page" disabled={page === 0} onClick={() => onPage(page - 1)} data-testid={`${testId}-previous`}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon" aria-label="Next page" title="Next page" disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)} data-testid={`${testId}-next`}>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
