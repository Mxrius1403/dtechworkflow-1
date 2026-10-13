import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/Field";
import { localInputValue, nice, today } from "@/lib/format";
import { nextProductionDay, productionDayInfo } from "@/lib/holidays";
import { notify } from "@/lib/notify";

const nowTime = () => localInputValue().slice(11, 16);

/** Moves weekends and Irish public holidays to the next production day and tells the user. */
export function productionDateOrNext(value) {
  const info = value && productionDayInfo(value);
  if (!info || info.available) return value;
  const next = nextProductionDay(value);
  notify(info.holiday ? `${info.holiday.name} is unavailable. Moved to ${nice(next)}.` : `Weekends are unavailable. Moved to ${nice(next)}.`);
  return next;
}

export const initialDue = (c) => ({ dueDate: c.currentDueDate || c.scheduledDate || "", dueTime: c.currentDueTime || "" });

/** Returns an error message when a changed due date/time is not allowed, otherwise "". */
export function dueScheduleError(c, { dueDate, dueTime }) {
  const before = initialDue(c);
  if (dueDate === before.dueDate && dueTime === before.dueTime) return "";
  if (!dueDate) return "Choose a completion due date";
  if (!dueTime) return "Choose a completion due time";
  if (dueDate < today()) return "The due date cannot be in the past";
  if (dueDate === today() && dueTime <= nowTime()) return "The due time cannot be in the past";
  return "";
}

/** Scheduled completion due date and time of an existing case. Changes are written to the case history. */
export function DueScheduleFields({ value, onChange, className }) {
  return (
    <div className={className}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Scheduled due date">
          <Input type="date" min={today()} value={value.dueDate} onChange={(e) => onChange({ ...value, dueDate: productionDateOrNext(e.target.value) })} data-testid="case-due-date-input" />
        </Field>
        <Field label="Scheduled due time">
          <Input type="time" value={value.dueTime} onChange={(e) => onChange({ ...value, dueTime: e.target.value })} data-testid="case-due-time-input" />
        </Field>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">A new due date or time is saved in the case history.</p>
    </div>
  );
}
