import { useState } from "react";
import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/DataTable";
import { Panel } from "@/components/common/Panel";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { ClinicDialog } from "./ClinicDialog";
import { ClinicImportDialog } from "./ClinicImportDialog";

export default function ClinicsPage() {
  const { clinics } = useData();
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);
  const rows = [...clinics].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return (
    <Panel
      title="Clinics"
      description="Clinic updates and imports are saved to the backend. Private contact details are encrypted at rest and available through a manager-only endpoint."
      actions={<>
        <Button variant="outline" onClick={() => setImporting(true)} data-testid="clinic-import-button"><Upload /> Import Clinics</Button>
        <Button onClick={() => setEditing({})} data-testid="clinic-add-button"><Plus /> Add Clinic</Button>
      </>}
    >
      <DataTable testId="clinics-table" rows={rows} rowTestId={(c) => `clinic-row-${c.id}`} empty="No clinics registered." columns={[
        { key: "id", header: "ID", render: (c) => <span className="font-mono font-bold">{c.id}</span> },
        { key: "name", header: "Clinic", render: (c) => <><p className="font-semibold">{c.name}</p><p className="text-xs text-muted-foreground">{c.address}</p></> },
        { key: "eircode", header: "Eircode", render: (c) => <span className="font-mono text-xs">{c.eircode}</span> },
        { key: "contact", header: "Contact data", render: (c) => <StatusBadge kind="flag" value={c.hasEmail ? "encrypted" : "protected"} label={c.hasEmail ? "Email on file" : "No email"} /> },
        { key: "active", header: "Status", render: (c) => <StatusBadge kind="account" value={c.active ? "active" : "inactive"} /> },
        { key: "edit", header: "", render: (c) => <Button size="sm" variant="outline" onClick={() => setEditing(c)} data-testid={`clinic-edit-${c.id}`}>Edit</Button> },
      ]} />
      {editing && <ClinicDialog clinic={editing.id ? editing : null} onClose={() => setEditing(null)} />}
      {importing && <ClinicImportDialog onClose={() => setImporting(false)} />}
    </Panel>
  );
}
