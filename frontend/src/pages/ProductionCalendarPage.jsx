import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CaseCard } from "@/components/cases/CaseCard";
import { useCaseDialogs } from "@/components/cases/CaseDialogsProvider";
import { BackLink, Muted } from "@/components/common/Bits";
import { MonthCalendar } from "@/components/common/MonthCalendar";
import { Panel } from "@/components/common/Panel";
import { CountPill } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { scheduledKey } from "@/lib/cases";
import { nice, plural, today } from "@/lib/format";
import { productionDayInfo } from "@/lib/holidays";
import { cn } from "@/lib/utils";

const open = (c) => c.status !== "completed" && c.status !== "removed";
const Tag = ({ className, children }) => <span className={cn("w-full truncate rounded px-1 py-0.5 text-[10px] font-semibold", className)}>{children}</span>;

function CalendarMonth() {
  const { cases } = useData();
  const navigate = useNavigate();
  const [ym, setYm] = useState(() => [Number(today().slice(0, 4)), Number(today().slice(5, 7)) - 1]);

  const renderDay = (key) => {
    const info = productionDayInfo(key);
    const rows = cases.filter((c) => open(c) && scheduledKey(c) === key);
    const missed = cases.filter((c) => open(c) && c.missedScheduleDates?.[key]);
    const over = rows.filter((c) => c.overdue).length;
    const hold = rows.filter((c) => ["on_hold", "need_information"].includes(c.attentionStatus)).length;
    const closed = info.holiday ? info.holiday.name : info.weekend ? "Unavailable" : "";
    return (
      <>
        {closed ? <Tag className="bg-zinc-100 text-zinc-500">{closed}</Tag> : <Tag className="text-muted-foreground">{plural(rows.length, "case")}</Tag>}
        {closed && rows.length > 0 && <Tag className="text-muted-foreground">{rows.length} existing</Tag>}
        {missed.length > 0 && <Tag className="bg-orange-50 text-orange-700" >{missed.length} missed → {[...new Set(missed.map(scheduledKey))].join(", ")}</Tag>}
        {over > 0 && <Tag className="bg-rose-50 text-rose-700">{over} overdue</Tag>}
        {hold > 0 && <Tag className="bg-amber-50 text-amber-800">{hold} attention</Tag>}
      </>
    );
  };

  return (
    <Panel description="Saturdays, Sundays and Irish public holidays are unavailable for scheduling. Missed production dates remain visible and unfinished cases move to the next available production day.">
      <MonthCalendar
        year={ym[0]} month={ym[1]} onMonthChange={(y, m) => setYm([y, m])} renderDay={renderDay} testId="production-calendar"
        dayProps={(key) => ({ onClick: () => navigate(`/calendar/${key}`), className: productionDayInfo(key).available ? "" : "bg-muted/60" })}
      />
    </Panel>
  );
}

function CalendarDay({ date }) {
  const { cases } = useData();
  const { openCase } = useCaseDialogs();
  const rows = cases.filter((c) => c.status !== "removed" && scheduledKey(c) === date).sort((a, b) => String(a.code).localeCompare(String(b.code)));
  const count = (s) => rows.filter((c) => c.status === s).length;
  return (
    <>
      <BackLink to="/calendar" testId="calendar-day-back">Calendar</BackLink>
      <Panel title={`Queue — ${nice(date)}`} actions={<><CountPill>{count("queue")} Queue</CountPill><CountPill>{count("production")} Production</CountPill><CountPill>{count("completed")} Completed</CountPill></>} data-testid="calendar-day-panel">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => <CaseCard key={c.id} c={c} onClick={() => openCase(c.id)} />)}
        </div>
        {!rows.length && <Muted>No cases scheduled.</Muted>}
      </Panel>
    </>
  );
}

export default function ProductionCalendarPage() {
  const { date } = useParams();
  if (date) return <CalendarDay date={date} />;
  return (
    <>
      <BackLink to="/dashboard">Back to Dashboard</BackLink>
      <CalendarMonth />
    </>
  );
}
