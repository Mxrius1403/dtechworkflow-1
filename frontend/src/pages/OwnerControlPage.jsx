import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Crown, Plus } from "lucide-react";
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
import { fetchManagers } from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";
import { StaffDialog } from "@/pages/technicians/StaffDialog";

export default function OwnerControlPage() {
  const { user, transferOwnership } = useSession();
  const queryClient = useQueryClient();
  const managersQuery = useQuery({ queryKey: ["managers"], queryFn: fetchManagers });
  const [addingManager, setAddingManager] = useState(false);
  const [selectedManager, setSelectedManager] = useState(null);
  const [transferring, setTransferring] = useState(false);
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
