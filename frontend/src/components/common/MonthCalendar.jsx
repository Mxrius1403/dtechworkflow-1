import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { keyOf, monthTitle, today } from "@/lib/format";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Month grid (Mon–Sun). renderDay(key) returns the cell content; dayProps(key) returns { className, onClick }. */
export function MonthCalendar({ year, month, onMonthChange, renderDay, dayProps = () => ({}), legend, testId = "calendar" }) {
  const first = new Date(Date.UTC(year, month, 1));
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const t = today();
  const shift = (delta) => {
    const m = month + delta;
    onMonthChange(m < 0 ? year - 1 : m > 11 ? year + 1 : year, (m + 12) % 12);
  };
  return (
    <div data-testid={testId}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Button variant="outline" size="icon" onClick={() => shift(-1)} data-testid={`${testId}-prev`}><ChevronLeft /></Button>
        <h3 className="text-base font-bold text-primary" data-testid={`${testId}-title`}>{monthTitle(year, month)}</h3>
        <Button variant="outline" size="icon" onClick={() => shift(1)} data-testid={`${testId}-next`}><ChevronRight /></Button>
      </div>
      {legend}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {WEEKDAYS.map((d) => <div key={d} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{d}</div>)}
        {Array.from({ length: offset }, (_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const key = keyOf(year, month, i + 1);
          const { className, onClick } = dayProps(key);
          const Tag = onClick ? "button" : "div";
          return (
            <Tag
              key={key}
              onClick={onClick}
              className={cn(
                "flex min-h-[64px] flex-col items-start gap-0.5 overflow-hidden rounded-lg border bg-card p-1.5 text-left text-[11px] sm:min-h-[92px] sm:p-2",
                onClick && "transition-colors hover:border-secondary hover:bg-accent/40",
                key === t && "ring-2 ring-secondary",
                className,
              )}
              data-testid={`${testId}-day-${key}`}
            >
              <span className="font-mono text-xs font-bold text-primary">{i + 1}</span>
              {renderDay(key)}
            </Tag>
          );
        })}
      </div>
    </div>
  );
}
