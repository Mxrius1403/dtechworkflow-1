import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/common/DataTable";
import { Field } from "@/components/common/Field";
import { useServiceTypes } from "@/hooks/use-service-types";
import { CASE_TEMPLATE_CSV, casesFromJson, downloadText, MAX_CASE_IMPORTS, normaliseCaseImport, parseCaseCsv, validateCaseImport } from "@/lib/csv";
import { importCases } from "@/lib/api";
import { notify, notifyError } from "@/lib/notify";

function Preview({ result }) {
  if (!result) return <p className="text-sm text-muted-foreground">Choose a file to validate it before importing.</p>;
  if (result.errors.length) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" data-testid="case-import-errors">
        <b>File needs correction</b>
        {result.errors.slice(0, 12).map((e) => <p key={e}>{e}</p>)}
        {result.errors.length > 12 && <p>+ {result.errors.length - 12} more errors</p>}
      </div>
    );
  }
  return (
    <div className="grid gap-2" data-testid="case-import-success">
      <p className="text-sm font-semibold text-emerald-700">{result.rows.length} case{result.rows.length === 1 ? "" : "s"} ready to import</p>
      <DataTable dense rows={result.rows.slice(0, 20)} rowKey={(c) => c.code} columns={[
        { key: "code", header: "Case" }, { key: "department", header: "Department" }, { key: "currentDueDate", header: "Due Date" }, { key: "status", header: "Status" },
        { key: "serviceTypes", header: "Services", render: (c) => c.serviceTypes.join(", ") }, { key: "arch", header: "Arch" },
      ]} />
      {result.rows.length > 20 && <p className="text-xs text-muted-foreground">Showing the first 20 of {result.rows.length} cases.</p>}
    </div>
  );
}

/** Import cases from the Case Search page (managers and owners only). */
export function CaseImportDialog({ onClose }) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const serviceTypes = useServiceTypes();
  const read = async (file) => {
    if (!file) return setResult(null);
    try {
      const text = await file.text();
      const rows = normaliseCaseImport(file.name.toLowerCase().endsWith(".json") ? casesFromJson(JSON.parse(text)) : parseCaseCsv(text), serviceTypes.byDepartment);
      setResult({ rows, errors: validateCaseImport(rows, serviceTypes.byDepartment) });
    } catch (err) {
      setResult({ rows: [], errors: [`Could not read this file. ${err.message}`] });
    }
  };
  const submit = async () => {
    setSaving(true);
    try {
      const response = await importCases(result.rows);
      await queryClient.invalidateQueries({ queryKey: ["data"] });
      notify(`${response.cases.length} case${response.cases.length === 1 ? "" : "s"} imported`);
      onClose();
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : "Could not import cases");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" data-testid="case-import-dialog">
        <DialogHeader>
          <DialogTitle>Import Cases</DialogTitle>
          <DialogDescription>Upload a CSV or JSON file (up to {MAX_CASE_IMPORTS} cases). Firebase exports are supported: deleted cases are skipped, missing due dates use scheduledDate or receivedDate, and missing service types or arch default to None. Service types must be set up for the case's department first; None is always accepted. Completed cases stay completed; other statuses become queue.</DialogDescription>
        </DialogHeader>
        <Button variant="outline" className="w-fit" onClick={() => downloadText("dtworkflow-cases-template.csv", CASE_TEMPLATE_CSV)} data-testid="case-template-download"><Download /> Download CSV Template</Button>
        <Field label="Case file"><Input type="file" accept=".csv,.json,text/csv,application/json" disabled={!serviceTypes.data} onChange={(e) => read(e.target.files?.[0])} data-testid="case-import-file" /></Field>
        {serviceTypes.isError && !serviceTypes.data ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 p-3 text-sm" role="alert">
            Service types could not be loaded, so the file cannot be checked yet.
            <Button size="sm" variant="outline" onClick={() => serviceTypes.refetch()}>Try Again</Button>
          </div>
        ) : <Preview result={result} />}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={!result || result.errors.length > 0 || saving} data-testid="case-import-submit">{saving ? "Importing…" : "Import Cases"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
