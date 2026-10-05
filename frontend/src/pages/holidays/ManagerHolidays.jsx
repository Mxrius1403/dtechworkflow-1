import { useState } from "react";
import { Check, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Muted } from "@/components/common/Bits";
import { ConfirmAction } from "@/components/common/ConfirmAction";
import { DataTable } from "@/components/common/DataTable";
import { Field, NativeSelect } from "@/components/common/Field";
import { Panel } from "@/components/common/Panel";
import { useData } from "@/context/DataContext";
import { departmentName } from "@/lib/cases";
import { activeLeave, annualLeaveStats } from "@/lib/leave";
import { demoSave } from "@/lib/notify";
import { LeaveCalendar, useLeaveMonth } from "./LeaveCalendar";
import { LeaveRow } from "./LeaveRow";
import { RejectLeaveDialog } from "./RejectLeaveDialog";

function ApproveButton({ r, requests }) {
  const clashes = requests.filter((x) => x.id !== r.id && x.status === "approved" && x.department === r.department && x.from <= r.to && x.to >= r.from);
  const approve = () => demoSave("Holiday approved");
  const button = <Button size="sm" onClick={clashes.length ? undefined : approve} data-testid={`leave-approve-${r.id}`}><Check /> Approve</Button>;
  if (!clashes.length) return button;
  return (
    <ConfirmAction title="Overlapping leave" description={`${clashes.length} approved request(s) in ${departmentName(r.department)} overlap this period. Approve anyway?`} confirmLabel="Approve anyway" onConfirm={approve} testId={`leave-approve-confirm-${r.id}`}>
      {button}
    </ConfirmAction>
  );
}

export function ManagerHolidays() {
  const { leaveRequests, users } = useData();
  const [ym, setYm] = useLeaveMonth();
  const [department, setDepartment] = useState("all");
  const [rejecting, setRejecting] = useState(null);
  const requests = activeLeave(leaveRequests);
  const pending = requests.filter((r) => r.status === "pending").sort((a, b) => String(a.from).localeCompare(String(b.from)));
  const history = [...requests].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const techs = users.filter((u) => u.role === "technician").map((u) => ({ ...u, ...annualLeaveStats(requests, u.id, ym[0]) }));

  return (
    <>
      <Panel title="Pending Requests" description="Approve or reject holiday requests. Only approved dates appear on the official calendar." actions={
        <Field label="Calendar department">
          <NativeSelect value={department} onChange={(e) => setDepartment(e.target.value)} data-testid="leave-department-filter">
            <option value="all">All Departments</option><option value="denture">Denture</option><option value="ortho">Ortho</option><option value="digital">Digital</option>
          </NativeSelect>
        </Field>
      }>
        <div className="grid gap-2">
          {pending.map((r) => (
            <LeaveRow key={r.id} r={r} showDepartment>
              <ApproveButton r={r} requests={requests} />
              <Button size="sm" variant="destructive" onClick={() => setRejecting(r)} data-testid={`leave-reject-${r.id}`}><X /> Reject</Button>
            </LeaveRow>
          ))}
          {!pending.length && <Muted>No pending requests.</Muted>}
        </div>
      </Panel>
      <Panel title="Team Calendar"><LeaveCalendar ym={ym} onChange={setYm} department={department} /></Panel>
      <Panel title={`Annual Leave Summary — ${ym[0]}`}>
        <DataTable dense testId="leave-summary-table" rows={techs} columns={[
          { key: "name", header: "Technician", render: (t) => <><b className="font-mono">{t.id}</b> — {t.name}</> },
          { key: "department", header: "Department", render: (t) => departmentName(t.department) },
          { key: "taken", header: "Days Taken" },
          { key: "future", header: "Future Approved" },
          { key: "pending", header: "Pending" },
          { key: "totalApproved", header: "Total Approved" },
        ]} />
      </Panel>
      <Panel title="Request History">
        <div className="grid gap-2">
          {history.map((r) => (
            <LeaveRow key={r.id} r={r}>
              <ConfirmAction title="Delete this holiday request from the system?" confirmLabel="Delete" onConfirm={() => demoSave("Holiday request deleted")} testId={`leave-delete-${r.id}`}>
                <Button size="sm" variant="outline" className="text-rose-700" data-testid={`leave-delete-button-${r.id}`}><Trash2 /> Delete</Button>
              </ConfirmAction>
            </LeaveRow>
          ))}
          {!history.length && <Muted>No requests.</Muted>}
        </div>
      </Panel>
      {rejecting && <RejectLeaveDialog request={rejecting} onClose={() => setRejecting(null)} />}
    </>
  );
}
