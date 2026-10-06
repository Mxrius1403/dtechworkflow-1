import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/common/Bits";
import { DataTable } from "@/components/common/DataTable";
import { Panel } from "@/components/common/Panel";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { useSession } from "@/context/SessionContext";
import { departmentName } from "@/lib/cases";
import { isToday, today } from "@/lib/format";
import { StaffDialog } from "./StaffDialog";

const Mini = ({ label, value }) => <div className="rounded-lg bg-muted/60 px-3 py-2"><p className="font-mono text-xl font-bold text-primary">{value}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>;

function TechCard({ u, cases }) {
  const mine = cases.filter((c) => c.technicianId === u.id || c.finishedById === u.id);
  const done = mine.filter((c) => c.status === "completed" && (isToday(c.finishedAt) || c.finishedDate === today())).length;
  return (
    <Panel className="lift" data-testid={`tech-card-${u.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs font-semibold text-secondary">{u.id}</p>
          <h3 className="text-lg font-bold text-primary">{u.name}</h3>
          <p className="text-xs text-muted-foreground">{departmentName(u.department)} • Login enabled</p>
        </div>
        <StatusBadge kind="account" value={u.active ? "active" : "inactive"} />
      </div>
      <div className="my-4 grid grid-cols-3 gap-2">
        <Mini label="Production" value={mine.filter((c) => c.status === "production").length} />
        <Mini label="Completed today" value={done} />
        <Mini label="Overdue" value={mine.filter((c) => c.overdue && c.status !== "completed").length} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline" data-testid={`tech-view-${u.id}`}><Link to={`/technicians/${u.id}`}>View Cases</Link></Button>
      </div>
    </Panel>
  );
}

function TechnicianCases({ id }) {
  const { cases, byId } = useData();
  const u = byId.users[id];
  const rows = cases.filter((c) => c.technicianId === id || c.finishedById === id).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return (
    <>
      <BackLink to="/technicians">Return to Technicians</BackLink>
      <Panel title={`${u?.name || id} • ${id}`} description="All cases associated with this permanent technician ID.">
        <DataTable dense testId="tech-cases-table" rows={rows} columns={[
          { key: "code", header: "Case", render: (c) => <span className="font-mono font-bold">{c.code}</span> },
          { key: "status", header: "Status", render: (c) => <StatusBadge kind="case" value={c.status} /> },
          { key: "startedTime", header: "Started", render: (c) => c.startedTime || "-" },
          { key: "finishedTime", header: "Finished", render: (c) => c.finishedTime || "-" },
          { key: "delivery", header: "Delivery", render: (c) => <StatusBadge kind="flag" value={c.overdue ? "overdue" : "ontime"} /> },
        ]} />
      </Panel>
    </>
  );
}

export default function TechniciansPage() {
  const data = useData();
  const { user } = useSession();
  const { id } = useParams();
  const [editing, setEditing] = useState(null);
  if (id) return <TechnicianCases id={id} />;
  const techs = data.users.filter((u) => u.role === "technician" && u.loginEnabled);
  return (
    <>
      <Panel description="Technicians sign in with individual accounts. Passwords are stored as secure hashes." actions={user.isOwner && <Button onClick={() => setEditing({})} data-testid="add-technician-button"><Plus /> Add Technician</Button>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {techs.map((u) => <TechCard key={u.id} u={u} cases={data.cases} />)}
      </div>
      {editing && <StaffDialog kind="technician" person={editing.id ? editing : null} onClose={() => setEditing(null)} />}
    </>
  );
}
