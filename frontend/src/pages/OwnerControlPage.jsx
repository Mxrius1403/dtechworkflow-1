import { Muted } from "@/components/common/Bits";
import { Panel } from "@/components/common/Panel";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";

export default function OwnerControlPage() {
  const { users } = useData();
  const managers = users.filter((u) => u.role === "manager");
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Primary Owner" value={1} accent="teal" testId="owner-stat-owner" />
        <StatCard label="Managers" value={managers.length} accent="indigo" testId="owner-stat-managers" />
        <StatCard label="Active Accounts" value={users.filter((u) => u.active).length} accent="emerald" testId="owner-stat-active" />
      </div>
      <Panel title="Demo Manager Records" description="These records are sample data. Only the environment-configured owner and created technicians can sign in.">
        <div className="grid gap-2">
          {managers.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3" data-testid={`manager-row-${m.id}`}>
              <div>
                <p className="font-semibold text-primary">{m.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{m.id} • Demo record</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge kind="account" value={m.active ? "active" : "inactive"} />
              </div>
            </div>
          ))}
          {!managers.length && <Muted>No Manager accounts yet.</Muted>}
        </div>
      </Panel>
    </>
  );
}
