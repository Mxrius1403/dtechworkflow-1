import { useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BackLink } from "@/components/common/Bits";
import { DataTable } from "@/components/common/DataTable";
import { Panel } from "@/components/common/Panel";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useQueryClient } from "@tanstack/react-query";
import { deleteClinic } from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";
import { useData } from "@/context/DataContext";
import { ClinicDialog } from "./ClinicDialog";
import { ClinicImportDialog } from "./ClinicImportDialog";

export default function ClinicsPage() {
  const { clinics } = useData();
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [openRoutes, setOpenRoutes] = useState(null);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const closeDelete = () => { setDeleteTarget(null); setOpenRoutes(null); };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteClinic(deleteTarget.id);
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify(`${deleteTarget.name} deleted`);
      closeDelete();
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (detail?.code === "clinic_has_routes") setOpenRoutes(detail.routes);
      else notifyError(typeof detail === "string" ? detail : "Could not delete clinic");
    } finally {
      setSaving(false);
    }
  };
  const rows = [...clinics].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return (
    <>
      <BackLink to="/delivery-management" className="text-base">Delivery Management</BackLink>
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
          { key: "delete", header: "", render: (c) => <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(c)} data-testid={`clinic-delete-${c.id}`}><Trash2 /> Delete</Button> },
        ]} />
        {editing && <ClinicDialog clinic={editing.id ? editing : null} onClose={() => setEditing(null)} />}
        {importing && <ClinicImportDialog onClose={() => setImporting(false)} />}
      </Panel>
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !saving) closeDelete(); }}>
        <AlertDialogContent data-testid="clinic-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{openRoutes ? "Clinic still has open stops" : "Delete clinic?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {openRoutes
                ? `${deleteTarget?.name} is still a stop on ${openRoutes.length} open route${openRoutes.length === 1 ? "" : "s"} (${openRoutes.map((r) => `${r.id}, ${r.date}`).join("; ")}). Remove these stops before deleting the clinic.`
                : `${deleteTarget?.name} and its contact details will be permanently deleted. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving} data-testid="clinic-delete-cancel">{openRoutes ? "Close" : "Cancel"}</AlertDialogCancel>
            {!openRoutes && (
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={saving} onClick={(event) => { event.preventDefault(); void confirmDelete(); }} data-testid="clinic-delete-confirm">
                <Trash2 /> {saving ? "Deleting…" : "Delete clinic"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
