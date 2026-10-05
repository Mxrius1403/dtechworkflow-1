import { useState } from "react";
import { MonthCalendar } from "@/components/common/MonthCalendar";
import { useData } from "@/context/DataContext";
import { today } from "@/lib/format";
import { productionDayInfo } from "@/lib/holidays";
import { activeLeave, leaveCovers } from "@/lib/leave";
import { cn } from "@/lib/utils";

/** Calendar month shared by technicians and managers; the selected year also drives the leave totals. */
export function useLeaveMonth() {
  return useState(() => [Number(today().slice(0, 4)), Number(today().slice(5, 7)) - 1]);
}

const Legend = () => (
  <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
    <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-amber-300" /> Irish public holiday</span>
    <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#0097a7]" /> Approved annual leave</span>
    <span>Public holidays and weekends are excluded from annual-leave days.</span>
  </div>
);

export function LeaveCalendar({ ym, onChange, department = "all" }) {
  const { leaveRequests, byId, techName } = useData();
  const approved = activeLeave(leaveRequests).filter((r) => r.status === "approved"
    && (department === "all" || (byId.users[r.technicianId]?.department || "denture") === department));

  const renderDay = (key) => {
    const { holiday } = productionDayInfo(key);
    const off = approved.filter((r) => leaveCovers(key, r));
    return (
      <>
        {holiday && <span className="w-full truncate rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-900">{holiday.name}</span>}
        {off.slice(0, 3).map((r) => <span key={r.id} className="w-full truncate rounded bg-[#0097a7]/10 px-1 text-[10px] font-semibold text-[#007784]">{techName(r.technicianId, r.technicianName)}</span>)}
        {off.length > 3 && <span className="text-[10px] text-muted-foreground">+{off.length - 3} more</span>}
      </>
    );
  };
  const dayProps = (key) => {
    const info = productionDayInfo(key);
    return { className: cn(info.weekend && "bg-muted/60", info.holiday && "border-amber-200 bg-amber-50/60") };
  };
  return <MonthCalendar year={ym[0]} month={ym[1]} onMonthChange={(y, m) => onChange([y, m])} renderDay={renderDay} dayProps={dayProps} legend={<Legend />} testId="leave-calendar" />;
}
