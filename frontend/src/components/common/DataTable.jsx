import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** columns: [{ key, header, render?(row), className? }] */
export function DataTable({ columns, rows, rowKey = (r) => r.id, empty = "Nothing to show.", testId, rowTestId, dense }) {
  return (
    <div className="overflow-x-auto rounded-lg border" data-testid={testId}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/60 hover:bg-muted/60">
            {columns.map((c) => (
              <TableHead key={c.key} className={cn("whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", c.className)}>
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-8 text-center text-sm text-muted-foreground">{empty}</TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={rowKey(row)} data-testid={rowTestId?.(row)} className="transition-colors">
              {columns.map((c) => (
                <TableCell key={c.key} className={cn(dense ? "py-2" : "py-3", "align-middle text-sm", c.className)}>
                  {c.render ? c.render(row) : row[c.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
