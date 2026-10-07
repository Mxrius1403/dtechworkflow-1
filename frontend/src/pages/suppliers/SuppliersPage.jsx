import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/common/ConfirmAction";
import { DataTable } from "@/components/common/DataTable";
import { Panel } from "@/components/common/Panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/Field";
import { useData } from "@/context/DataContext";
import { createSupplier, deleteSupplier, updateSupplier } from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";

function SupplierDialog({ supplier, onClose }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(supplier?.name || "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim()) return notifyError("Enter a supplier name");
    setSaving(true);
    try {
      if (supplier) await updateSupplier(supplier.id, { name: name.trim() });
      else await createSupplier({ name: name.trim() });
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify(supplier ? "Supplier updated" : "Supplier added");
      onClose();
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : `Could not ${supplier ? "update" : "add"} the supplier`);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" data-testid="supplier-dialog">
        <DialogHeader><DialogTitle>{supplier ? "Edit Supplier" : "Add Supplier"}</DialogTitle></DialogHeader>
        <Field label="Name">
          <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} data-testid="supplier-name-input" />
        </Field>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} data-testid="supplier-cancel">Cancel</Button>
          <Button onClick={save} disabled={saving} data-testid="supplier-save">{saving ? "Saving…" : supplier ? "Save Changes" : "Add Supplier"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SuppliersPage() {
  const { suppliers } = useData();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const rows = [...suppliers].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const remove = async (supplierId) => {
    setDeletingId(supplierId);
    try {
      await deleteSupplier(supplierId);
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify("Supplier deleted");
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not delete the supplier");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Panel
      title="Suppliers"
      description="Manage the supplier names used by the lab."
      actions={<Button onClick={() => setAdding(true)} data-testid="supplier-add-button"><Plus /> Add Supplier</Button>}
    >
      <DataTable
        testId="suppliers-table"
        rows={rows}
        rowTestId={(supplier) => `supplier-row-${supplier.id}`}
        empty="No suppliers yet."
        columns={[
          { key: "name", header: "Name" },
          {
            key: "edit",
            header: "",
            render: (supplier) => (
              <Button size="sm" variant="outline" onClick={() => setEditing(supplier)} data-testid={`supplier-edit-${supplier.id}`}>
                <Pencil /> Edit
              </Button>
            ),
          },
          {
            key: "delete",
            header: "",
            render: (supplier) => (
              <ConfirmAction
                title={`Delete ${supplier.name}?`}
                description="This action cannot be undone."
                confirmLabel="Delete Supplier"
                onConfirm={() => remove(supplier.id)}
                testId={`supplier-delete-${supplier.id}`}
              >
                <Button size="sm" variant="destructive" disabled={deletingId === supplier.id} data-testid={`supplier-delete-button-${supplier.id}`}>
                  <Trash2 /> Delete
                </Button>
              </ConfirmAction>
            ),
          },
        ]}
      />
      {adding && <SupplierDialog onClose={() => setAdding(false)} />}
      {editing && <SupplierDialog supplier={editing} onClose={() => setEditing(null)} />}
    </Panel>
  );
}
