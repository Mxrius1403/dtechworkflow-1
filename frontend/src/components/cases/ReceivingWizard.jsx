import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ARCH_OPTIONS, SERVICE_TYPES } from "@/config/constants";
import { nice, today } from "@/lib/format";
import { nextProductionDay, productionDayInfo } from "@/lib/holidays";
import { departmentName } from "@/lib/cases";
import { notify, notifyError } from "@/lib/notify";
import { cn } from "@/lib/utils";

const chip = (on) => cn("rounded-lg border-2 px-3 py-3 text-sm font-semibold transition-colors", on ? "border-secondary bg-accent text-accent-foreground" : "border-border bg-card hover:border-secondary/50");

/** Receiving wizard: Prosthesis = service types → arch → production date; other departments = date only. */
export function ReceivingWizard({ draft, onClose, onSave }) {
  const prosthesis = draft.department === "prosthesis" || draft.department === "denture";
  const [step, setStep] = useState(prosthesis ? "types" : "schedule");
  const [types, setTypes] = useState([]);
  const [arch, setArch] = useState("");
  const [date, setDate] = useState(nextProductionDay(today()));
  const [saving, setSaving] = useState(false);
  const label = `${draft.reentry ? "Re-entry" : "New case"} ${draft.code}`;

  const toggle = (t) => setTypes(types.includes(t) ? types.filter((x) => x !== t) : [...types, t]);
  const pickDate = (value) => {
    const info = value && productionDayInfo(value);
    if (!info || info.available) return setDate(value);
    const next = nextProductionDay(value);
    setDate(next);
    notify(info.holiday ? `${info.holiday.name} is unavailable. Moved to ${nice(next)}.` : `Weekends are unavailable. Moved to ${nice(next)}.`);
  };
  const save = async () => {
    if (!date) return notifyError("Choose a production date");
    setSaving(true);
    try {
      const saved = await onSave({ productionDate: date, serviceTypes: types, arch });
      if (saved) onClose();
    } finally {
      setSaving(false);
    }
  };

  const steps = {
    types: {
      title: `${label} — Service Type`, description: "Select one or more. A single case can contain multiple stages.",
      body: <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{SERVICE_TYPES.map((t) => <button key={t} className={chip(types.includes(t))} onClick={() => toggle(t)} data-testid={`service-type-${t.toLowerCase().replace(/\s/g, "-")}`}>{t}</button>)}</div>,
      next: () => (types.length ? setStep("arch") : notifyError("Select at least one service type")), nextLabel: "Next",
    },
    arch: {
      title: `Case ${draft.code} — Arch`, description: "Choose one option.",
      body: <div className="grid gap-2 sm:grid-cols-3">{ARCH_OPTIONS.map((a) => <button key={a} className={chip(arch === a)} onClick={() => { setArch(a); setStep("schedule"); }} data-testid={`arch-${a.toLowerCase().replace(/\W+/g, "-")}`}>{a}</button>)}</div>,
      back: () => setStep("types"),
    },
    schedule: {
      title: `Schedule Case ${draft.code}`, description: "Saturdays, Sundays and Irish public holidays are unavailable. Re-entry starts with a fresh overdue status.",
      body: (
        <div className="grid gap-3">
          {prosthesis && <p className="text-sm"><b>{types.join(" + ")}</b> • {arch}</p>}
          <Input type="date" min={today()} value={date} onChange={(e) => pickDate(e.target.value)} data-testid="receiving-date-input" />
        </div>
      ),
      next: save, nextLabel: "Add to Schedule", back: prosthesis ? () => setStep("arch") : null,
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
