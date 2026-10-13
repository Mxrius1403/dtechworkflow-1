import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { BackLink } from "@/components/common/Bits";
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
  const [email, setEmail] = useState(supplier?.email || "");
  const [address, setAddress] = useState(supplier?.address || "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim()) return notifyError("Enter a supplier name");
    setSaving(true);
    try {
      const details = {
        name: name.trim(),
        email: email.trim() || null,
        address: address.trim() || null,
      };
      if (supplier) await updateSupplier(supplier.id, details);
      else await createSupplier(details);
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
      <DialogContent className="max-w-lg" data-testid="supplier-dialog">
        <DialogHeader><DialogTitle>{supplier ? "Edit Supplier" : "Add Supplier"}</DialogTitle></DialogHeader>
        <Field label="Name">
          <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} data-testid="supplier-name-input" />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} data-testid="supplier-email-input" />
        </Field>
        <Field label="Address">
          <Input value={address} onChange={(event) => setAddress(event.target.value)} data-testid="supplier-address-input" />
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
    <>
      <BackLink to="/materials">Material Management</BackLink>
      <Panel
        title="Suppliers"
        description="Manage supplier names and contact details."
        actions={<Button onClick={() => setAdding(true)} data-testid="supplier-add-button"><Plus /> Add Supplier</Button>}
      >
        <DataTable
          testId="suppliers-table"
          rows={rows}
          rowTestId={(supplier) => `supplier-row-${supplier.id}`}
          empty="No suppliers yet."
          columns={[
            { key: "name", header: "Name" },
            { key: "email", header: "Email", render: (supplier) => supplier.email || "—" },
            { key: "address", header: "Address", render: (supplier) => supplier.address || "—" },
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
    </>
  );
}
