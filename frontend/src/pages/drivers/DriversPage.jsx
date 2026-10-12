import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { deleteDriver } from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";
import { useData } from "@/context/DataContext";
import { StaffDialog } from "@/pages/technicians/StaffDialog";

export default function DriversPage() {
  const { drivers, settings } = useData();
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [openRoutes, setOpenRoutes] = useState(null);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const closeDelete = () => { setDeleteTarget(null); setOpenRoutes(null); };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteDriver(deleteTarget.id, Boolean(openRoutes));
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify(`${deleteTarget.name} deleted`);
      closeDelete();
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (detail?.code === "driver_has_routes") setOpenRoutes(detail.routes);
      else notifyError(typeof detail === "string" ? detail : "Could not delete driver");
    } finally {
      setSaving(false);
    }
  };
  const rows = [...drivers].sort((a, b) => a.id.localeCompare(b.id));
  return (
    <>
      <BackLink to="/delivery-management">Delivery Management</BackLink>
      <Panel
        title="Drivers"
        description="Drivers sign in with their own account and only see the routes assigned to them."
        actions={<Button onClick={() => setEditing({})} data-testid="driver-add-button"><Plus /> Add Driver</Button>}
      >
        <DataTable testId="drivers-table" rows={rows} rowTestId={(d) => `driver-row-${d.id}`} empty="No drivers yet." columns={[
          { key: "id", header: "ID", render: (d) => <span className="font-mono font-bold">{d.id}</span> },
          { key: "name", header: "Name" },
          { key: "status", header: "Status", render: (d) => <StatusBadge kind="account" value={d.active !== false ? "active" : "inactive"} /> },
          { key: "security", header: "Security", render: () => <StatusBadge kind="flag" value="protected" /> },
          { key: "edit", header: "", render: (d) => <Button size="sm" variant="outline" onClick={() => setEditing(d)} data-testid={`driver-edit-${d.id}`}>Edit</Button> },
          { key: "delete", header: "", render: (d) => d.active === false ? <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(d)} data-testid={`driver-delete-${d.id}`}><Trash2 /> Delete</Button> : null },
        ]} />
        {editing && <StaffDialog kind="driver" person={editing.id ? editing : null} nextId={`D${String(settings.nextDriverNumber || 1).padStart(4, "0")}`} onClose={() => setEditing(null)} />}
      </Panel>
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !saving) closeDelete(); }}>
        <AlertDialogContent data-testid="driver-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{openRoutes ? "Driver still has open routes" : "Delete inactive driver account?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {openRoutes
                ? `${deleteTarget?.name} still has ${openRoutes.length} open route${openRoutes.length === 1 ? "" : "s"} (${openRoutes.map((r) => `${r.id}, ${r.date}`).join("; ")}). Deleting the driver anyway will also delete these routes.`
                : `${deleteTarget?.name} will be permanently deleted. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving} data-testid="driver-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={saving} onClick={(event) => { event.preventDefault(); void confirmDelete(); }} data-testid="driver-delete-confirm">
              <Trash2 /> {saving ? "Deleting…" : openRoutes ? "Delete driver and routes" : "Delete driver"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
