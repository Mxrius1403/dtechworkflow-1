import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Muted } from "@/components/common/Bits";
import { ConfirmAction } from "@/components/common/ConfirmAction";
import { Field } from "@/components/common/Field";
import { Panel } from "@/components/common/Panel";
import { StatCard } from "@/components/common/StatCard";
import { useData } from "@/context/DataContext";
import { useSession } from "@/context/SessionContext";
import { plural, today } from "@/lib/format";
import { publicHolidaysBetween, workingDaysBetween } from "@/lib/holidays";
import { activeLeave, annualLeaveStats, overlapsExisting } from "@/lib/leave";
import { demoSave, notifyError } from "@/lib/notify";
import { LeaveCalendar, useLeaveMonth } from "./LeaveCalendar";
import { LeaveRow } from "./LeaveRow";

function RequestForm({ requests, user }) {
  const [range, setRange] = useState({ from: "", to: "" });
  const set = (key) => (e) => setRange({ ...range, [key]: e.target.value });
  const valid = range.from && range.to && range.from <= range.to;
  const days = valid ? workingDaysBetween(range.from, range.to) : 0;
  const excluded = valid ? publicHolidaysBetween(range.from, range.to) : [];
  const submit = () => {
    if (!valid) return notifyError("Choose a valid date range");
    if (overlapsExisting(requests, user.id, range.from, range.to)) return notifyError("You already have a holiday request that overlaps these dates.");
    if (!days) return notifyError("The selected period has no annual-leave working days after weekends and public holidays are excluded.");
    const holidayText = excluded.length ? ` ${plural(excluded.length, "public holiday")} excluded.` : "";
    demoSave(`Holiday request sent for ${plural(days, "annual-leave day")}.${holidayText}`);
    setRange({ from: "", to: "" });
  };
  return (
    <Panel title="Request Holiday" description="Select a start and end date. Saturdays, Sundays and Irish public holidays are not deducted from annual leave.">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="From"><Input type="date" min={today()} value={range.from} onChange={set("from")} data-testid="leave-from" /></Field>
        <Field label="To"><Input type="date" min={range.from || today()} value={range.to} onChange={set("to")} data-testid="leave-to" /></Field>
        <Button onClick={submit} data-testid="leave-submit"><Send /> Request Holiday</Button>
      </div>
      {valid && <p className="mt-3 text-xs text-muted-foreground" data-testid="leave-preview">{plural(days, "working day")}{excluded.length > 0 && ` • ${excluded.map((h) => h.name).join(", ")} excluded`}</p>}
    </Panel>
  );
}

export function TechnicianHolidays() {
  const { leaveRequests } = useData();
  const { user } = useSession();
  const [ym, setYm] = useLeaveMonth();
  const requests = activeLeave(leaveRequests);
  const stats = annualLeaveStats(requests, user.id, ym[0]);
  const mine = requests.filter((r) => r.technicianId === user.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Approved Days Taken" value={stats.taken} accent="emerald" testId="leave-stat-taken" />
        <StatCard label="Future Approved" value={stats.future} accent="teal" testId="leave-stat-future" />
        <StatCard label="Pending Days" value={stats.pending} accent="amber" testId="leave-stat-pending" />
        <StatCard label={`Total Approved ${ym[0]}`} value={stats.totalApproved} accent="indigo" testId="leave-stat-total" />
      </div>
      <RequestForm requests={requests} user={user} />
      <Panel title="Team Calendar"><LeaveCalendar ym={ym} onChange={setYm} /></Panel>
      <Panel title="My Requests">
        <div className="grid gap-2">
          {mine.map((r) => (
            <LeaveRow key={r.id} r={r} showName={false}>
              {r.status === "pending" && (
                <ConfirmAction title="Cancel this pending request?" confirmLabel="Cancel request" onConfirm={() => demoSave("Holiday request cancelled")} testId={`leave-cancel-${r.id}`}>
                  <Button size="sm" variant="destructive" data-testid={`leave-cancel-button-${r.id}`}>Cancel</Button>
                </ConfirmAction>
              )}
            </LeaveRow>
          ))}
          {!mine.length && <Muted>No holiday requests.</Muted>}
        </div>
      </Panel>
    </>
  );
}
