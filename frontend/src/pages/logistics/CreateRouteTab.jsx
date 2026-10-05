import { useState } from "react";
import { Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Muted } from "@/components/common/Bits";
import { Field, NativeSelect, Options } from "@/components/common/Field";
import { Panel } from "@/components/common/Panel";
import { useData } from "@/context/DataContext";
import { plural } from "@/lib/format";
import { ACTIVE_ROUTE_STATUSES, draftStopCount, isFourDigitCase } from "@/lib/logistics";
import { demoSave, notifyError } from "@/lib/notify";

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

function CollectionsPanel({ draft }) {
  const { clinics, byId } = useData();
  const [form, setForm] = useState({ clinicId: "", notes: "" });
  const add = () => {
    if (!form.clinicId) return notifyError("Select a clinic");
    draft.addCollection({ clinicId: form.clinicId, notes: form.notes.trim() });
    setForm({ clinicId: "", notes: "" });
  };
  return (
    <Panel title="Collections">
      <div className="grid gap-3">
        <Field label="Clinic"><NativeSelect value={form.clinicId} onChange={(e) => setForm({ ...form, clinicId: e.target.value })} data-testid="collection-clinic"><option value="">Select clinic</option><ClinicOptions clinics={clinics} /></NativeSelect></Field>
        <Field label="Notes"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Operational notes only — no patient identifiers" data-testid="collection-notes" /></Field>
        <Button onClick={add} data-testid="collection-add"><Plus /> Add Collection</Button>
        {draft.collections.map((x, i) => <DraftLine key={i} title={byId.clinics[x.clinicId]?.name} text={`Collection${x.notes ? ` • ${x.notes}` : ""}`} onRemove={() => draft.removeCollection(i)} testId={`draft-collection-${i}`} />)}
      </div>
    </Panel>
  );
}

function DeliveriesPanel({ draft }) {
  const { clinics, byId } = useData();
  const [form, setForm] = useState({ clinicId: "", caseNumber: "" });
  const add = () => {
    const caseNumber = form.caseNumber.trim();
    if (!form.clinicId) return notifyError("Select a clinic");
    if (!isFourDigitCase(caseNumber)) return notifyError("Delivery case must contain exactly 4 digits");
    if (draft.deliveries.some((d) => d.caseNumber === caseNumber)) return notifyError("This case is already in the route draft");
    draft.addDeliveries([{ clinicId: form.clinicId, caseNumber }]);
    setForm({ ...form, caseNumber: "" });
  };
  return (
    <Panel title="Deliveries">
      <div className="grid gap-3">
        <Field label="Clinic"><NativeSelect value={form.clinicId} onChange={(e) => setForm({ ...form, clinicId: e.target.value })} data-testid="delivery-clinic"><option value="">Select clinic</option><ClinicOptions clinics={clinics} /></NativeSelect></Field>
        <Field label="Case number"><Input value={form.caseNumber} maxLength={4} inputMode="numeric" placeholder="6423" onChange={(e) => setForm({ ...form, caseNumber: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add()} data-testid="delivery-case" /></Field>
        <Button onClick={add} data-testid="delivery-add"><Plus /> Add Delivery</Button>
        {draft.deliveries.map((x, i) => <DraftLine key={`${x.caseNumber}-${i}`} title={byId.clinics[x.clinicId]?.name} text={`Delivery ${x.caseNumber}${x.productionCaseId ? " • ready case" : ""}`} onRemove={() => draft.removeDelivery(i)} testId={`draft-delivery-${x.caseNumber}`} />)}
      </div>
    </Panel>
  );
}

export function CreateRouteTab({ draft, onPublished }) {
  const { drivers, routes, byId } = useData();
  const driver = byId.drivers[draft.driverId];
  const stops = draftStopCount(draft.collections, draft.deliveries);
  const publish = () => {
    if (!draft.date || !driver) return notifyError("Select date and driver");
    if (!draft.collections.length && !draft.deliveries.length) return notifyError("Add at least one delivery or collection");
    const existing = routes.find((r) => r.date === draft.date && r.driverId === driver.id && ACTIVE_ROUTE_STATUSES.includes(r.status));
    demoSave(existing ? `Visits added to existing route ${existing.id}` : `Route published to ${driver.name} • ${plural(stops, "stop")}`);
    draft.reset();
    onPublished(draft.date);
  };
  return (
    <>
      <Panel title="Create Route" description="Deliveries and collections for the same clinic are grouped into one stop.">
        <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
          <Field label="Route date"><Input type="date" value={draft.date} onChange={(e) => draft.setDate(e.target.value)} data-testid="route-date" /></Field>
          <Field label="Driver">
            <NativeSelect value={draft.driverId} onChange={(e) => draft.setDriverId(e.target.value)} data-testid="route-driver">
              <option value="">Select driver</option>
              <DriverOptions drivers={drivers.filter((d) => d.active !== false)} />
            </NativeSelect>
          </Field>
        </div>
      </Panel>
      <div className="grid items-start gap-5 xl:grid-cols-3">
        <CollectionsPanel draft={draft} />
        <DeliveriesPanel draft={draft} />
        <Panel title="Mission Summary" className="xl:sticky xl:top-24" data-testid="mission-summary">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Driver</dt><dd className="font-semibold" data-testid="summary-driver">{driver?.name || "Not selected"}</dd>
            <dt className="text-muted-foreground">Collections</dt><dd className="font-mono font-bold" data-testid="summary-collections">{draft.collections.length}</dd>
            <dt className="text-muted-foreground">Deliveries</dt><dd className="font-mono font-bold" data-testid="summary-deliveries">{draft.deliveries.length}</dd>
            <dt className="text-muted-foreground">Stops</dt><dd className="font-mono font-bold" data-testid="summary-stops">{stops}</dd>
          </dl>
          <Muted>The driver chooses the clinic order before starting.</Muted>
          <Button className="w-full bg-secondary hover:bg-secondary/90" onClick={publish} data-testid="route-publish"><Send /> Publish Route</Button>
        </Panel>
      </div>
    </>
  );
}
