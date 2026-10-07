import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Crown, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Muted } from "@/components/common/Bits";
import { Panel } from "@/components/common/Panel";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useSession } from "@/context/SessionContext";
import { deleteManager, fetchManagers, updateManagerStatus } from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";
import { StaffDialog } from "@/pages/technicians/StaffDialog";

export default function OwnerControlPage() {
  const { user, transferOwnership } = useSession();
  const queryClient = useQueryClient();
  const managersQuery = useQuery({ queryKey: ["managers"], queryFn: fetchManagers });
  const [addingManager, setAddingManager] = useState(false);
  const [editingManager, setEditingManager] = useState(null);
  const [selectedManager, setSelectedManager] = useState(null);
  const [transferring, setTransferring] = useState(false);
  const [managerStatusTarget, setManagerStatusTarget] = useState(null);
  const [updatingManagerStatus, setUpdatingManagerStatus] = useState(false);
  const [managerDeleteTarget, setManagerDeleteTarget] = useState(null);
  const [deletingManager, setDeletingManager] = useState(false);
  const managers = managersQuery.data || [];
  const activeManagers = managers.filter((manager) => manager.active).length;

  const confirmTransfer = async () => {
    if (!selectedManager) return;
    setTransferring(true);
    try {
      await transferOwnership(selectedManager.id);
      queryClient.removeQueries({ queryKey: ["managers"] });
      notify(`Ownership transferred to ${selectedManager.name}`);
      setSelectedManager(null);
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not transfer ownership");
    } finally {
      setTransferring(false);
    }
  };

  const confirmManagerStatusChange = async () => {
    if (!managerStatusTarget) return;
    setUpdatingManagerStatus(true);
    try {
      await updateManagerStatus(managerStatusTarget.id, !managerStatusTarget.active);
      await queryClient.invalidateQueries({ queryKey: ["managers"] });
      notify(`${managerStatusTarget.name}'s account ${managerStatusTarget.active ? "deactivated" : "activated"}`);
      setManagerStatusTarget(null);
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not update manager account");
    } finally {
      setUpdatingManagerStatus(false);
    }
  };

  const confirmManagerDelete = async () => {
    if (!managerDeleteTarget) return;
    setDeletingManager(true);
    try {
      await deleteManager(managerDeleteTarget.id);
      await queryClient.invalidateQueries({ queryKey: ["managers"] });
      notify(`${managerDeleteTarget.name}'s account deleted; history was kept`);
      setManagerDeleteTarget(null);
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not delete manager account");
    } finally {
      setDeletingManager(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Current Owner" value={user.name} accent="teal" testId="owner-stat-owner" />
        <StatCard label="Managers" value={managers.length} accent="indigo" testId="owner-stat-managers" />
        <StatCard label="Active Accounts" value={activeManagers + 1} accent="emerald" testId="owner-stat-active" />
      </div>

      <Panel title="Current owner" description="The owner has exclusive access to manager accounts and ownership transfer.">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <div>
            <p className="font-semibold text-primary">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <StatusBadge kind="account" value="active" label="Owner" />
        </div>
      </Panel>

      <Panel
        title="Managers"
        description="Manager accounts are separate from technician accounts and can sign in with their own credentials."
        actions={<Button onClick={() => setAddingManager(true)} data-testid="add-manager-button"><Plus /> Add Manager</Button>}
      >
        {managersQuery.isLoading ? (
          <Muted>Loading managers…</Muted>
        ) : managersQuery.isError ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-destructive">Could not load manager accounts.</p>
            <Button variant="outline" size="sm" onClick={() => managersQuery.refetch()}>Retry</Button>
          </div>
        ) : managers.length ? (
          <div className="grid gap-2">
            {managers.map((manager) => (
              <div key={manager.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3" data-testid={`manager-row-${manager.id}`}>
                <div>
                  <p className="font-semibold text-primary">{manager.name}</p>
                  <p className="text-sm text-muted-foreground">{manager.email}</p>
                  <p className="font-mono text-xs text-muted-foreground">{manager.id}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge kind="account" value={manager.active ? "active" : "inactive"} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingManager(manager)}
                    data-testid={`manager-edit-${manager.id}`}
                  >
                    <Pencil /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setManagerStatusTarget(manager)}
                    data-testid={`manager-toggle-active-${manager.id}`}
                  >
                    <Power /> {manager.active ? "Deactivate" : "Activate"}
                  </Button>
                  {!manager.active && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setManagerDeleteTarget(manager)}
                      data-testid={`manager-delete-${manager.id}`}
                    >
                      <Trash2 /> Delete
                    </Button>
                  )}
                  {manager.active && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedManager(manager)}
                      data-testid={`transfer-ownership-${manager.id}`}
                    >
                      <ArrowRightLeft /> Transfer ownership
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Muted>No managers yet. Add a manager before transferring ownership.</Muted>
        )}
      </Panel>

      {addingManager && <StaffDialog kind="manager" onClose={() => setAddingManager(false)} />}
      {editingManager && (
        <StaffDialog
          kind="manager"
          person={editingManager}
          onClose={() => setEditingManager(null)}
        />
      )}

      <AlertDialog
        open={Boolean(managerStatusTarget)}
        onOpenChange={(open) => {
          if (!open && !updatingManagerStatus) setManagerStatusTarget(null);
        }}
      >
        <AlertDialogContent data-testid="manager-status-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {managerStatusTarget?.active ? "Deactivate manager account?" : "Activate manager account?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {managerStatusTarget && (
                managerStatusTarget.active
                  ? `${managerStatusTarget.name} will no longer be able to sign in. Any active sessions will be signed out.`
                  : `${managerStatusTarget.name} will be able to sign in again.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updatingManagerStatus} data-testid="manager-status-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={managerStatusTarget?.active ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              disabled={updatingManagerStatus}
              onClick={(event) => {
                event.preventDefault();
                void confirmManagerStatusChange();
              }}
              data-testid="manager-status-confirm"
            >
              <Power /> {updatingManagerStatus ? "Saving…" : managerStatusTarget?.active ? "Deactivate account" : "Activate account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(managerDeleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deletingManager) setManagerDeleteTarget(null);
        }}
      >
        <AlertDialogContent data-testid="manager-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete inactive manager account?</AlertDialogTitle>
            <AlertDialogDescription>
              {managerDeleteTarget && `${managerDeleteTarget.name}'s sign-in credentials will be removed. Existing history will be kept.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingManager} data-testid="manager-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingManager}
              onClick={(event) => {
                event.preventDefault();
                void confirmManagerDelete();
              }}
              data-testid="manager-delete-confirm"
            >
              <Trash2 /> {deletingManager ? "Deleting…" : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(selectedManager)}
        onOpenChange={(open) => {
          if (!open && !transferring) setSelectedManager(null);
        }}
      >
        <AlertDialogContent data-testid="ownership-transfer-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer ownership?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedManager && (
                <>
                  {selectedManager.name} will become the owner. Your account will become a manager, and
                  {` ${selectedManager.name}`}’s existing sessions will be signed out. This cannot be undone
                  from your manager account.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={transferring} data-testid="ownership-transfer-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={transferring}
              onClick={(event) => {
                event.preventDefault();
                void confirmTransfer();
              }}
              data-testid="ownership-transfer-confirm"
            >
              <Crown /> {transferring ? "Transferring…" : "Transfer ownership"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
