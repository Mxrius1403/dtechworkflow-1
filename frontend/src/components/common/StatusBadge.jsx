import { STATUS, TONES } from "@/config/statuses";
import { cn } from "@/lib/utils";

/** <StatusBadge kind="case" value="queue" /> — labels and colours come from config/statuses.js */
export function StatusBadge({ kind, value, label, className, testId }) {
  const [text, tone] = STATUS[kind]?.[value] || [label || value, "slate"];
  return (
    <span
      className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", TONES[tone], className)}
      data-testid={testId}
    >
      {label || text}
    </span>
  );
}

export function CountPill({ children, className, testId }) {
  return (
    <span className={cn("inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-primary/5 px-2 py-0.5 font-mono text-xs font-bold text-primary", className)} data-testid={testId}>
      {children}
    </span>
  );
}
