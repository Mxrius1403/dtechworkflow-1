import { useState } from "react";
import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/DataTable";
import { Field, NativeSelect, Options } from "@/components/common/Field";
import { Panel } from "@/components/common/Panel";
import { OTHER_WORK_ACTIVITIES } from "@/config/constants";
import { useData } from "@/context/DataContext";
import { useSession } from "@/context/SessionContext";
import { dateTimeOf, formatDuration, minutesBetween } from "@/lib/format";
import { demoSave, notifyError } from "@/lib/notify";

/** Ortho technicians record bench-free work; it appears as "OW" in production reports. */
export default function OtherWorkPage() {
  const { otherWork } = useData();
  const { user } = useSession();
  const [activity, setActivity] = useState(OTHER_WORK_ACTIVITIES[0]);
  const mine = otherWork.filter((x) => x.technicianId === user.id).sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
  const active = mine.find((x) => !x.finishedAt);
  const start = () => (active ? notifyError("Finish the active Other Work first") : demoSave(`Other Work started — ${activity}`));

  return (
    <>
      <Panel title="Other Work" description="Record necessary Ortho work performed away from the case bench. It appears as OW in the production report.">
        {active ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-l-4 border-l-[#0097a7] bg-accent/40 p-4" data-testid="other-work-active">
            <div>
              <p className="eyebrow">In progress</p>
              <p className="text-lg font-bold text-primary">{active.activity}</p>
              <p className="text-xs text-muted-foreground">Started {dateTimeOf(active.startedAt)}</p>
            </div>
            <Button onClick={() => demoSave("Other Work completed")} data-testid="other-work-finish"><Square /> Finish Other Work</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Activity" className="min-w-[240px]">
              <NativeSelect value={activity} onChange={(e) => setActivity(e.target.value)} data-testid="other-work-activity">
                <Options items={OTHER_WORK_ACTIVITIES.map((a) => [a, a])} />
              </NativeSelect>
            </Field>
            <Button onClick={start} data-testid="other-work-start"><Play /> Start Other Work</Button>
          </div>
        )}
      </Panel>
      <Panel title="Recent Other Work">
        <DataTable dense testId="other-work-table" rows={mine.slice(0, 20)} empty="No Other Work records." columns={[
          { key: "code", header: "Case", render: () => <span className="font-mono font-bold">OW</span> },
          { key: "activity", header: "Activity" },
          { key: "startedAt", header: "Started", render: (x) => dateTimeOf(x.startedAt) },
          { key: "finishedAt", header: "Finished", render: (x) => (x.finishedAt ? dateTimeOf(x.finishedAt) : <span className="font-semibold text-secondary">Active</span>) },
          { key: "duration", header: "Duration", render: (x) => (x.finishedAt ? formatDuration(minutesBetween(x.startedAt, x.finishedAt)) : "-") },
        ]} />
      </Panel>
    </>
  );
}
