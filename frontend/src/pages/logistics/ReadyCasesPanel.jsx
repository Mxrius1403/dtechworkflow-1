import { useMemo, useState } from "react";
import { PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/common/DataTable";
import { Field, NativeSelect } from "@/components/common/Field";
import { Panel } from "@/components/common/Panel";
import { CountPill } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { departmentName } from "@/lib/cases";
import { dateTimeOf } from "@/lib/format";
import { inDraft, isRouteCaseCode, readyAvailable, readyKey, unroutedCases } from "@/lib/logistics";
import { notify, notifyError } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { ClinicOptions } from "./CreateRouteTab";

export function ReadyCasesPanel({ draft, onAdded, completedOnly = false }) {
  const { cases, stops, clinics, byId } = useData();
  const [search, setSearch] = useState("");
  const [clinicId, setClinicId] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const all = useMemo(
    () => unroutedCases(cases, stops, byId.routes, completedOnly ? ["completed"] : undefined),
    [cases, stops, byId.routes, completedOnly],
  );
  const available = (c) => readyAvailable(c, draft.deliveries);
  const rows = all.filter((c) => !search || String(c.code).toLowerCase().includes(search.toLowerCase()));
  const selectable = rows.filter(available);
  const picked = all.filter((c) => selected.has(readyKey(c)) && available(c));
  const count = rows.length;
  const toggle = (keys, on) => setSelected((prev) => {
    const next = new Set(prev);
    keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
    return next;
  });

  const add = () => {
    const clinic = byId.clinics[clinicId];
    if (!clinic || clinic.active === false) return notifyError("Select an active destination clinic");
    if (!picked.length) return notifyError("Select cases that are not already in a route");
    draft.addDeliveries(picked.map((c) => ({ clinicId, caseNumber: String(c.code).trim(), productionCaseId: c.id, productionConfirmedAt: c.managerConfirmedAt || "" })));
    setSelected(new Set());
    notify("Selected cases added to the route draft. Choose date and driver, then publish.");
    onAdded();
  };

  const status = (c) => {
    if (inDraft(c, draft.deliveries)) return "In route draft";
    return isRouteCaseCode(c.code) ? "Not in a route — select a clinic" : "Case number is not valid for a route";
  };
  const columns = [
    {
      key: "pick", className: "w-10",
      header: <Checkbox aria-label="Select all available cases shown" checked={selectable.length > 0 && selectable.every((c) => selected.has(readyKey(c)))} disabled={!selectable.length} onCheckedChange={(on) => toggle(selectable.map(readyKey), on)} data-testid="ready-select-all" />,
      render: (c) => <Checkbox aria-label={`Select case ${c.code}`} checked={selected.has(readyKey(c)) && available(c)} disabled={!available(c)} onCheckedChange={(on) => toggle([readyKey(c)], on)} data-testid={`ready-select-${c.code}`} />,
    },
    { key: "code", header: "Case", render: (c) => <span className="font-mono font-bold">{c.code}</span> },
    { key: "department", header: "Department", render: (c) => departmentName(c.department) },
    { key: "received", header: "Received", render: (c) => dateTimeOf(c.receivedAt) },
    { key: "status", header: "Status", render: (c) => <span className={cn("text-xs", !isRouteCaseCode(c.code) && "font-semibold text-amber-700")}>{status(c)}</span> },
  ];

  return (
    <Panel title="Ready for Delivery" description="Cases not already in a route. Select cases for the same clinic, then add them to your route." actions={<CountPill testId="ready-awaiting-count">{count} awaiting routing</CountPill>} data-testid="ready-cases-panel">
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Input className="h-8 w-40" value={search} onChange={(e) => setSearch(e.target.value.trim())} placeholder="Find case" aria-label="Find case" data-testid="ready-search" />
      </div>
      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg bg-muted/50 p-3">
        <Field label="Destination clinic" className="min-w-[260px] flex-1">
          <NativeSelect value={clinicId} onChange={(e) => setClinicId(e.target.value)} data-testid="ready-clinic-select">
            <option value="">Select clinic for selected cases</option>
            <ClinicOptions clinics={clinics} />
          </NativeSelect>
        </Field>
        <Button onClick={add} disabled={!picked.length} data-testid="ready-add-to-route"><PackagePlus /> Add selected to route ({picked.length})</Button>
      </div>
      <DataTable dense testId="ready-cases-table" rows={rows} rowKey={readyKey} rowTestId={(c) => `ready-row-${c.code}`} empty="No cases in this list." columns={columns} />
    </Panel>
  );
}
