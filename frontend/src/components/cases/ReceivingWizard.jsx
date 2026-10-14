import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ARCH_OPTIONS, NO_SERVICE_TYPE } from "@/config/constants";
import { useServiceTypes } from "@/hooks/use-service-types";
import { localInputValue, today } from "@/lib/format";
import { nextProductionDay } from "@/lib/holidays";
import { departmentName } from "@/lib/cases";
import { notifyError } from "@/lib/notify";
import { serviceTypeOptions } from "@/lib/serviceTypes";
import { cn } from "@/lib/utils";
import { productionDateOrNext } from "./DueScheduleFields";

const nowTime = () => localInputValue().slice(11, 16);
const nextMinute = () => localInputValue(Date.now() + 60_000).slice(11, 16);

const chip = (on) => cn("rounded-lg border-2 px-3 py-3 text-sm font-semibold transition-colors", on ? "border-secondary bg-accent text-accent-foreground" : "border-border bg-card hover:border-secondary/50");

/** Receiving wizard: service types → arch → completion due date and time for every department. */
export function ReceivingWizard({ draft, onClose, onSave }) {
  const [step, setStep] = useState("types");
  const [types, setTypes] = useState([]);
  const [arch, setArch] = useState("");
  const [date, setDate] = useState(nextProductionDay(today()));
  const [time, setTime] = useState(nextMinute);
  const [timeEdited, setTimeEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const serviceTypes = useServiceTypes();
  const options = serviceTypeOptions(serviceTypes.byDepartment, draft.department);
  const label = `${draft.reentry ? "Re-entry" : "New case"} ${draft.code}`;

  const toggle = (t) => setTypes((selected) => {
    if (selected.includes(t)) return selected.filter((x) => x !== t);
    return t === NO_SERVICE_TYPE ? [NO_SERVICE_TYPE] : [...selected.filter((x) => x !== NO_SERVICE_TYPE), t];
  });
  const pickDate = (value) => setDate(productionDateOrNext(value));
  const pickTime = (value) => { setTime(value); setTimeEdited(true); };
  const toSchedule = () => {
    if (!timeEdited) setTime(nextMinute());
    setStep("schedule");
  };
  const save = async () => {
    // An untouched time follows the clock, so "Add to Schedule" works straight away even after a pause.
    const dueTime = !timeEdited && date === today() && time <= nowTime() ? nextMinute() : time;
    if (!date) return notifyError("Choose a completion due date");
    if (!dueTime) return notifyError("Choose a completion due time");
    if (date === today() && dueTime <= nowTime()) return notifyError("The due time cannot be in the past");
    setTime(dueTime);
    setSaving(true);
    try {
      const saved = await onSave({ productionDate: date, dueTime, serviceTypes: types, arch });
      if (saved) onClose();
    } finally {
      setSaving(false);
    }
  };

  const steps = {
    types: {
      title: `${label} — Service Type`, description: "Select one or more. A single case can contain multiple stages.",
      body: serviceTypes.data ? (
        <div className="grid gap-3">
          <div className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">{options.map((t) => <button key={t} className={chip(types.includes(t))} onClick={() => toggle(t)} data-testid={`service-type-${t.toLowerCase().replace(/\s/g, "-")}`}>{t}</button>)}</div>
          {options.length === 1 && <p className="text-xs text-muted-foreground" data-testid="service-types-empty">No service types are set up for {departmentName(draft.department)} yet, so only None can be chosen. Managers add them in Case Management under Service Types.</p>}
        </div>
      ) : serviceTypes.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 p-3 text-sm" role="alert" data-testid="service-types-error">
          Service types could not be loaded.
          <Button size="sm" variant="outline" onClick={() => serviceTypes.refetch()}>Try Again</Button>
        </div>
      ) : (
        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" /> Loading service types…</p>
      ),
      next: () => (types.length ? setStep("arch") : notifyError("Select at least one service type")), nextLabel: "Next",
    },
    arch: {
      title: `Case ${draft.code} — Arch`, description: "Choose one option.",
      body: <div className="grid gap-2 sm:grid-cols-3">{ARCH_OPTIONS.map((a) => <button key={a} className={chip(arch === a)} onClick={() => { setArch(a); toSchedule(); }} data-testid={`arch-${a.toLowerCase().replace(/\W+/g, "-")}`}>{a}</button>)}</div>,
      back: () => setStep("types"),
    },
    schedule: {
      title: `Schedule Case ${draft.code}`, description: "Saturdays, Sundays and Irish public holidays are unavailable. Re-entry starts with a fresh overdue status.",
      body: (
        <div className="grid gap-3">
          <p className="text-sm"><b>{types.join(" + ")}</b> • {arch}</p>
          <label htmlFor="receiving-due-date" className="grid gap-2 text-sm font-medium">
            Completion due date
            <Input id="receiving-due-date" type="date" min={today()} value={date} onChange={(e) => pickDate(e.target.value)} data-testid="receiving-date-input" />
          </label>
          <label htmlFor="receiving-due-time" className="grid gap-2 text-sm font-medium">
            Completion due time
            <Input id="receiving-due-time" type="time" required value={time} onChange={(e) => pickTime(e.target.value)} data-testid="receiving-time-input" />
            <span className="text-xs font-normal text-muted-foreground">The case must be completed by this date and time.</span>
          </label>
        </div>
      ),
      next: save, nextLabel: "Add to Schedule", back: () => setStep("arch"),
    },
  }[step];

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-w-lg" data-testid="receiving-wizard">
        <DialogHeader>
          <p className="eyebrow">{departmentName(draft.department)} receiving</p>
          <DialogTitle>{steps.title}</DialogTitle>
          <DialogDescription>{steps.description}</DialogDescription>
        </DialogHeader>
        {steps.body}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} data-testid="receiving-cancel">Cancel</Button>
          {steps.back && <Button variant="outline" onClick={steps.back} disabled={saving} data-testid="receiving-back">Back</Button>}
          {steps.next && <Button onClick={steps.next} disabled={saving} data-testid="receiving-next">{saving ? "Saving…" : steps.nextLabel}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
