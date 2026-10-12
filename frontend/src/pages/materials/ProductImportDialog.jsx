import { useState } from "react";
import readXlsxFile from "read-excel-file/browser";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/DataTable";
import { Field } from "@/components/common/Field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { importProducts } from "@/lib/api";
import { findExistingProductRefs, findProductWorksheet, normaliseProductImport } from "@/lib/productImport";
import { notify, notifyError } from "@/lib/notify";

function ImportPreview({ result }) {
  if (!result) return <p className="text-sm text-muted-foreground">Choose an Excel file to validate it before importing.</p>;
  if (result.errors.length) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" data-testid="product-import-errors">
        <b>File needs correction</b>
        {result.errors.slice(0, 12).map((error) => <p key={error}>{error}</p>)}
        {result.errors.length > 12 && <p>+ {result.errors.length - 12} more errors</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-2" data-testid="product-import-success">
      <p className="text-sm font-semibold text-emerald-700">
        {result.rows.length} product{result.rows.length === 1 ? "" : "s"} ready to import
        {result.skippedInactive > 0 && `; ${result.skippedInactive} inactive skipped`}
      </p>
      <DataTable
        dense
        rows={result.rows.slice(0, 20)}
        rowKey={(product) => product.refNo}
        columns={[
          { key: "refNo", header: "Ref. No" },
          { key: "title", header: "Title" },
          { key: "producer", header: "Producer" },
          { key: "quantity", header: "Quantity" },
          { key: "unit", header: "Unit" },
        ]}
      />
      {result.rows.length > 20 && <p className="text-xs text-muted-foreground">Showing the first 20 of {result.rows.length} products.</p>}
    </div>
  );
}

export function ProductImportDialog({ suppliers, existingProducts, onClose }) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const read = async (file) => {
    if (!file) {
      setResult(null);
      return;
    }
    try {
      const worksheet = findProductWorksheet(await readXlsxFile(file));
      if (!worksheet) throw new Error("No worksheet with a Product Code or Ref No. column was found.");
      const parsed = normaliseProductImport(worksheet, suppliers);
      setResult({
        ...parsed,
        errors: [...parsed.errors, ...findExistingProductRefs(parsed.rows, existingProducts)],
      });
    } catch (error) {
      setResult({
        rows: [],
        errors: [`Could not read this Excel file. ${error.message}`],
        skippedInactive: 0,
      });
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      const response = await importProducts(result.rows);
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      notify(`${response.imported} product${response.imported === 1 ? "" : "s"} imported`);
      onClose();
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not import products");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" data-testid="product-import-dialog">
        <DialogHeader>
          <DialogTitle>Import Products</DialogTitle>
          <DialogDescription>
            Upload an .xlsx file. Product Code (or Ref No.) becomes Ref. No; Description, Brand, Supplier and Pack / Size are mapped to the product fields.
          </DialogDescription>
        </DialogHeader>
        <Field label="Excel file">
          <Input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => read(event.target.files?.[0])} data-testid="product-import-file" />
        </Field>
        <ImportPreview result={result} />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} data-testid="product-import-cancel">Cancel</Button>
          <Button onClick={submit} disabled={!result || result.errors.length > 0 || saving} data-testid="product-import-submit">
            {saving ? "Importing…" : "Import Products"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
