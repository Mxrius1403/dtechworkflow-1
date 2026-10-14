import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { BackLink } from "@/components/common/Bits";
import { ConfirmAction } from "@/components/common/ConfirmAction";
import { Field } from "@/components/common/Field";
import { Panel } from "@/components/common/Panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NO_SERVICE_TYPE } from "@/config/constants";
import { SERVICE_TYPES_KEY, useServiceTypes } from "@/hooks/use-service-types";
import { createServiceType, deleteServiceType, renameServiceType } from "@/lib/api";
import { DEPARTMENTS, departmentName } from "@/lib/cases";
import { notify, notifyError } from "@/lib/notify";
import { SERVICE_TYPE_NAME_LIMIT, serviceTypeKey } from "@/lib/serviceTypes";

const errorDetail = (error, fallback) => {
  const detail = error.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
};

/** The reason `name` cannot be used in `department`, or "" when it can. `ownId` skips the type being renamed. */
function nameProblem(name, department, serviceTypes, ownId) {
  const key = serviceTypeKey(name);
  if (!key) return "Enter a service type name";
  if (key === serviceTypeKey(NO_SERVICE_TYPE)) return "None is always available and does not need to be added";
  const existing = serviceTypes.find((t) => t.department === department && t.id !== ownId && serviceTypeKey(t.name) === key);
  return existing ? `${existing.name} already exists for ${departmentName(department)}` : "";
}

function RenameDialog({ serviceType, serviceTypes, onClose }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(serviceType.name);
  const [saving, setSaving] = useState(false);
  const save = async (event) => {
    event.preventDefault();
    const problem = nameProblem(name, serviceType.department, serviceTypes, serviceType.id);
    if (problem) return notifyError(problem);
    setSaving(true);
    try {
      await renameServiceType(serviceType.id, name.trim());
      await queryClient.invalidateQueries({ queryKey: SERVICE_TYPES_KEY });
      notify("Service type renamed");
      onClose();
    } catch (error) {
      notifyError(errorDetail(error, "Could not rename the service type"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-w-md" data-testid="service-type-rename-dialog">
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Rename Service Type</DialogTitle>
            <DialogDescription>Cases already received keep the name they were saved with.</DialogDescription>
          </DialogHeader>
          <Field label={`${departmentName(serviceType.department)} service type`}>
            <Input autoFocus value={name} maxLength={SERVICE_TYPE_NAME_LIMIT} onChange={(e) => setName(e.target.value)} data-testid="service-type-rename-input" />
          </Field>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving} data-testid="service-type-rename-save">{saving ? "Saving…" : "Save Name"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DepartmentServiceTypes({ department, serviceTypes, onRename }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const label = departmentName(department);
  const rows = serviceTypes.filter((t) => t.department === department);

  const add = async (event) => {
    event.preventDefault();
    const problem = nameProblem(name, department, serviceTypes);
    if (problem) return notifyError(problem);
    setAdding(true);
    try {
      await createServiceType({ department, name: name.trim() });
      await queryClient.invalidateQueries({ queryKey: SERVICE_TYPES_KEY });
      setName("");
      notify(`Service type added to ${label}`);
    } catch (error) {
      notifyError(errorDetail(error, "Could not add the service type"));
    } finally {
      setAdding(false);
    }
  };

  const remove = async (serviceType) => {
    setDeletingId(serviceType.id);
    try {
      await deleteServiceType(serviceType.id);
      await queryClient.invalidateQueries({ queryKey: SERVICE_TYPES_KEY });
      notify("Service type deleted");
    } catch (error) {
      notifyError(errorDetail(error, "Could not delete the service type"));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-border p-4" data-testid={`service-types-${department}`}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="font-bold text-primary">{label}</h3>
        <span className="text-xs text-muted-foreground">{rows.length} set up</span>
      </div>
      <form onSubmit={add} className="mb-3 flex gap-2">
        <Input
          value={name}
          maxLength={SERVICE_TYPE_NAME_LIMIT}
          onChange={(e) => setName(e.target.value)}
          placeholder="New service type"
          aria-label={`New ${label} service type`}
          data-testid={`service-type-new-${department}`}
        />
        <Button type="submit" disabled={adding} data-testid={`service-type-add-${department}`}>
          {adding ? <Loader2 className="animate-spin" /> : <Plus />} Add
        </Button>
      </form>
      <ul className="grid gap-1.5">
        {rows.map((serviceType) => (
          <li key={serviceType.id} className="flex items-center gap-2 rounded-md border border-border/70 bg-card py-1 pl-3 pr-1 text-sm" data-testid={`service-type-row-${serviceType.id}`}>
            <span className="min-w-0 flex-1 break-words font-medium">{serviceType.name}</span>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => onRename(serviceType)} aria-label={`Rename ${serviceType.name}`} title="Rename" data-testid={`service-type-rename-${serviceType.id}`}>
              <Pencil />
            </Button>
            <ConfirmAction
              title={`Delete ${serviceType.name}?`}
              description={`It can no longer be chosen for new ${label} cases. Cases already received keep it.`}
              confirmLabel="Delete Service Type"
              destructiveConfirm
              onConfirm={() => remove(serviceType)}
              testId={`service-type-delete-${serviceType.id}`}
            >
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" disabled={deletingId === serviceType.id} aria-label={`Delete ${serviceType.name}`} title="Delete" data-testid={`service-type-delete-button-${serviceType.id}`}>
                <Trash2 />
              </Button>
            </ConfirmAction>
          </li>
        ))}
        <li className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground" data-testid={`service-type-none-${department}`}>
          <span className="flex-1 font-medium">{NO_SERVICE_TYPE}</span>
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-xs">Always available</span>
        </li>
      </ul>
    </section>
  );
}

export default function ServiceTypesPage() {
  const serviceTypes = useServiceTypes();
  const [renaming, setRenaming] = useState(null);
  const list = serviceTypes.data || [];

  return (
    <>
      <BackLink to="/case-management" className="text-base">Case Management</BackLink>
      <Panel
        title="Service Types"
        description="Set up the service types for each department. Technicians choose from these when they receive a case. None is always available, even when a department has no service types yet."
      >
        {serviceTypes.data ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {DEPARTMENTS.map((department) => (
              <DepartmentServiceTypes key={department} department={department} serviceTypes={list} onRename={setRenaming} />
            ))}
          </div>
        ) : serviceTypes.isError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 p-3 text-sm" role="alert">
            Service types could not be loaded.
            <Button size="sm" variant="outline" onClick={() => serviceTypes.refetch()}>Try Again</Button>
          </div>
        ) : (
          <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-secondary" />
        )}
      </Panel>
      {renaming && <RenameDialog serviceType={renaming} serviceTypes={list} onClose={() => setRenaming(null)} />}
    </>
  );
}
