import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BackLink } from "@/components/common/Bits";
import { DataTable } from "@/components/common/DataTable";
import { Panel } from "@/components/common/Panel";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { useSession } from "@/context/SessionContext";
import { deleteTechnician, updateTechnicianStatus } from "@/lib/api";
import { isToday, today } from "@/lib/format";
import { notify, notifyError } from "@/lib/notify";
import { StaffDialog } from "./StaffDialog";

const Mini = ({ label, value }) => <div className="rounded-lg bg-muted/60 px-3 py-2"><p className="font-mono text-xl font-bold text-primary">{value}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>;

function TechCard({ u, cases, canManage, onEdit, onToggleStatus, onDelete }) {
  const mine = cases.filter((c) => c.technicianId === u.id || c.finishedById === u.id);
  const done = mine.filter((c) => c.status === "completed" && (isToday(c.finishedAt) || c.finishedDate === today())).length;
  return (
    <Panel className="lift" data-testid={`tech-card-${u.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs font-semibold text-secondary">{u.id}</p>
          <h3 className="text-lg font-bold text-primary">{u.name}</h3>
          {u.email && <p className="text-xs text-muted-foreground">{u.email}</p>}
          <p className="text-xs text-muted-foreground">Login {u.active ? "enabled" : "disabled"}</p>
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
        {canManage && (
          <>
            <Button size="sm" variant="outline" onClick={() => onEdit(u)} data-testid={`tech-edit-${u.id}`}>
              <Pencil /> Edit
            </Button>
            <Button size="sm" variant="outline" onClick={() => onToggleStatus(u)} data-testid={`tech-toggle-active-${u.id}`}>
              <Power /> {u.active ? "Deactivate" : "Activate"}
            </Button>
            {!u.active && (
              <Button size="sm" variant="destructive" onClick={() => onDelete(u)} data-testid={`tech-delete-${u.id}`}>
                <Trash2 /> Delete
              </Button>
            )}
          </>
        )}
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
  const queryClient = useQueryClient();
  const { id } = useParams();
  const [editing, setEditing] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  if (id) return <TechnicianCases id={id} />;
  const techs = data.users.filter((u) => u.role === "technician" && u.loginEnabled && !u.deleted);

  const confirmStatusChange = async () => {
    if (!statusTarget) return;
    setSaving(true);
    try {
      await updateTechnicianStatus(statusTarget.id, !statusTarget.active);
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify(`${statusTarget.name}'s account ${statusTarget.active ? "deactivated" : "activated"}`);
      setStatusTarget(null);
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not update technician account");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteTechnician(deleteTarget.id);
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify(`${deleteTarget.name}'s account deleted; history was kept`);
      setDeleteTarget(null);
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not delete technician account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Panel description="Technicians sign in with individual accounts. Inactive accounts can be archived without removing their history." actions={user.isManager && <Button onClick={() => setEditing({})} data-testid="add-technician-button"><Plus /> Add Technician</Button>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {techs.map((u) => <TechCard key={u.id} u={u} cases={data.cases} canManage={user.isManager} onEdit={setEditing} onToggleStatus={setStatusTarget} onDelete={setDeleteTarget} />)}
      </div>
      {editing && <StaffDialog kind="technician" person={editing.id ? editing : null} onClose={() => setEditing(null)} />}
      <AlertDialog open={Boolean(statusTarget)} onOpenChange={(open) => { if (!open && !saving) setStatusTarget(null); }}>
        <AlertDialogContent data-testid="tech-status-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{statusTarget?.active ? "Deactivate technician account?" : "Activate technician account?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.active
                ? `${statusTarget.name} will no longer be able to sign in. Any active sessions will be signed out.`
                : `${statusTarget?.name} will be able to sign in again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving} data-testid="tech-status-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction className={statusTarget?.active ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""} disabled={saving} onClick={(event) => { event.preventDefault(); void confirmStatusChange(); }} data-testid="tech-status-confirm">
              <Power /> {saving ? "Saving…" : statusTarget?.active ? "Deactivate account" : "Activate account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !saving) setDeleteTarget(null); }}>
        <AlertDialogContent data-testid="tech-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete inactive technician account?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && `${deleteTarget.name}'s sign-in credentials will be removed. Existing cases and work history will be kept.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving} data-testid="tech-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={saving} onClick={(event) => { event.preventDefault(); void confirmDelete(); }} data-testid="tech-delete-confirm">
              <Trash2 /> {saving ? "Deleting…" : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
