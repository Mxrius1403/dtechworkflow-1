import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Muted } from "@/components/common/Bits";
import { Field, NativeSelect, Options } from "@/components/common/Field";
import { Panel } from "@/components/common/Panel";
import { CountPill } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { createLogisticsRoute } from "@/lib/api";
import { plural } from "@/lib/format";
import { ACTIVE_ROUTE_STATUSES, draftStopCount } from "@/lib/logistics";
import { notify, notifyError } from "@/lib/notify";

export const ClinicOptions = ({ clinics }) => <Options items={clinics.filter((c) => c.active !== false).map((c) => [c.id, `${c.name} — ${c.eircode}`])} />;
export const DriverOptions = ({ drivers }) => <Options items={drivers.map((d) => [d.id, `${d.id} — ${d.name}`])} />;

function DraftLine({ title, text, onRemove, testId }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2" data-testid={testId}>
      <div className="min-w-0"><p className="truncate text-sm font-semibold text-primary">{title}</p><p className="truncate text-xs text-muted-foreground">{text}</p></div>
      <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600" onClick={onRemove} data-testid={`${testId}-remove`}><X /></Button>
    </div>
  );
}

function CollectionForm({ draft }) {
  const { clinics } = useData();
  const [form, setForm] = useState({ clinicId: "", notes: "" });
  const add = () => {
    if (!form.clinicId) return notifyError("Select a clinic");
    draft.addCollection({ clinicId: form.clinicId, notes: form.notes.trim() });
    setForm({ clinicId: "", notes: "" });
  };
  return (
    <Panel title="Add Collection" description="Clinics the driver should collect from.">
      <div className="grid gap-3">
        <Field label="Clinic"><NativeSelect value={form.clinicId} onChange={(e) => setForm({ ...form, clinicId: e.target.value })} data-testid="collection-clinic"><option value="">Select clinic</option><ClinicOptions clinics={clinics} /></NativeSelect></Field>
        <Field label="Notes"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Operational notes only — no patient identifiers" data-testid="collection-notes" /></Field>
        <Button onClick={add} data-testid="collection-add"><Plus /> Add Collection</Button>
      </div>
    </Panel>
  );
}

function RouteDraftPanel({ draft }) {
  const { byId } = useData();
  const column = (title, count, empty, children) => (
    <div className="grid content-start gap-2">
      <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-primary">{title}</h3><CountPill>{count}</CountPill></div>
      {!count && <Muted>{empty}</Muted>}
      {children}
    </div>
  );
  return (
    <Panel title="Route Draft" description="Everything that will be published with this route.">
      <div className="grid gap-5 md:grid-cols-2">
        {column("Deliveries", draft.deliveries.length, "No deliveries yet — select cases above.",
          draft.deliveries.map((x, i) => <DraftLine key={`${x.caseNumber}-${i}`} title={byId.clinics[x.clinicId]?.name} text={`Delivery ${x.caseNumber}${x.productionCaseId ? " • ready case" : ""}`} onRemove={() => draft.removeDelivery(i)} testId={`draft-delivery-${x.caseNumber}`} />))}
        {column("Collections", draft.collections.length, "No collections yet.",
          draft.collections.map((x, i) => <DraftLine key={i} title={byId.clinics[x.clinicId]?.name} text={`Collection${x.notes ? ` • ${x.notes}` : ""}`} onRemove={() => draft.removeCollection(i)} testId={`draft-collection-${i}`} />))}
      </div>
    </Panel>
  );
}

export function CreateRouteTab({ draft, onPublished, readyCases }) {
  const queryClient = useQueryClient();
  const { drivers, routes, byId } = useData();
  const [saving, setSaving] = useState(false);
  const driver = byId.drivers[draft.driverId];
  const stops = draftStopCount(draft.collections, draft.deliveries);
  const publish = async () => {
    if (!draft.date || !driver) return notifyError("Select date and driver");
    if (!draft.collections.length && !draft.deliveries.length) return notifyError("Add at least one delivery or collection");
    const existing = routes.find((r) => r.date === draft.date && r.driverId === driver.id && ACTIVE_ROUTE_STATUSES.includes(r.status));
    setSaving(true);
    try {
      await createLogisticsRoute({
        date: draft.date,
        driverId: driver.id,
        deliveries: draft.deliveries,
        collections: draft.collections,
      });
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify(existing ? `Visits added to existing route ${existing.id}` : `Route published to ${driver.name} • ${plural(stops, "stop")}`);
      const publishedDate = draft.date;
      draft.reset();
      onPublished(publishedDate);
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not publish the route");
    } finally {
      setSaving(false);
    }
  };
  const stat = (label, value, testId) => (
    <div className="rounded-lg bg-muted/50 px-4 py-2 text-center"><p className="font-mono text-xl font-bold text-primary" data-testid={testId}>{value}</p><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p></div>
  );
  return (
    <>
      <Panel title="Create Route" description="Deliveries and collections for the same clinic are separate stops. The driver chooses the clinic order before starting." className="lg:sticky lg:top-16 lg:z-10" data-testid="mission-summary">
        <div className="grid items-end gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Route date"><Input type="date" value={draft.date} onChange={(e) => draft.setDate(e.target.value)} data-testid="route-date" /></Field>
            <Field label="Driver">
              <NativeSelect value={draft.driverId} onChange={(e) => draft.setDriverId(e.target.value)} data-testid="route-driver">
                <option value="">Select driver</option>
                <DriverOptions drivers={drivers.filter((d) => d.active !== false)} />
              </NativeSelect>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {stat("Deliveries", draft.deliveries.length, "summary-deliveries")}
            {stat("Collections", draft.collections.length, "summary-collections")}
            {stat("Stops", stops, "summary-stops")}
          </div>
          <div className="grid gap-1">
            <p className="text-xs text-muted-foreground">Driver: <span className="font-semibold text-foreground" data-testid="summary-driver">{driver?.name || "Not selected"}</span></p>
            <Button className="bg-secondary hover:bg-secondary/90" onClick={publish} disabled={saving} data-testid="route-publish"><Send /> {saving ? "Publishing…" : "Publish Route"}</Button>
          </div>
        </div>
      </Panel>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {readyCases}
        <CollectionForm draft={draft} />
      </div>
      <RouteDraftPanel draft={draft} />
    </>
  );
}
