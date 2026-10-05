import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/common/DataTable";
import { Field } from "@/components/common/Field";
import { useData } from "@/context/DataContext";
import { CLINIC_TEMPLATE_CSV, downloadText, normaliseClinicImport, parseClinicCsv, validateClinicImport } from "@/lib/csv";
import { demoSave } from "@/lib/notify";

function Preview({ result }) {
  if (!result) return <p className="text-sm text-muted-foreground">Choose a file to validate it before importing.</p>;
  if (result.errors.length) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" data-testid="clinic-import-errors">
        <b>File needs correction</b>
        {result.errors.slice(0, 12).map((e) => <p key={e}>{e}</p>)}
        {result.errors.length > 12 && <p>+ {result.errors.length - 12} more errors</p>}
      </div>
    );
  }
  return (
    <div className="grid gap-2" data-testid="clinic-import-success">
      <p className="text-sm font-semibold text-emerald-700">{result.rows.length} clinic{result.rows.length === 1 ? "" : "s"} ready to import</p>
      <DataTable dense rows={result.rows.slice(0, 20)} rowKey={(c) => `${c.name}-${c.eircode}`} columns={[
        { key: "name", header: "Clinic" }, { key: "address", header: "Address" }, { key: "eircode", header: "Eircode" },
        { key: "contact", header: "Contact", render: (c) => c.contact || c.email || "—" },
      ]} />
      {result.rows.length > 20 && <p className="text-xs text-muted-foreground">Showing the first 20 of {result.rows.length} clinics.</p>}
    </div>
  );
}

export function ClinicImportDialog({ onClose }) {
  const { clinics } = useData();
  const [result, setResult] = useState(null);
  const read = async (file) => {
    if (!file) return setResult(null);
    try {
      const text = await file.text();
      const rows = normaliseClinicImport(file.name.toLowerCase().endsWith(".json") ? JSON.parse(text) : parseClinicCsv(text));
      setResult({ rows, errors: validateClinicImport(rows) });
    } catch (err) {
      setResult({ rows: [], errors: [`Could not read this file. ${err.message}`] });
    }
  };
  const submit = () => {
    const known = new Set(clinics.map((c) => `${c.name.toLowerCase()}|${c.eircode}`));
    const updated = result.rows.filter((c) => known.has(`${c.name.toLowerCase()}|${c.eircode}`)).length;
    demoSave(`${result.rows.length - updated} clinics added • ${updated} updated securely`);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" data-testid="clinic-import-dialog">
        <DialogHeader>
          <DialogTitle>Import Clinics</DialogTitle>
          <DialogDescription>Upload a CSV or JSON file containing clinic name, address, Eircode, email, phone, contact person and notes. Do not include patient information.</DialogDescription>
        </DialogHeader>
        <Button variant="outline" className="w-fit" onClick={() => downloadText("dtworkflow-clinics-template.csv", CLINIC_TEMPLATE_CSV)} data-testid="clinic-template-download"><Download /> Download CSV Template</Button>
        <Field label="Clinic file"><Input type="file" accept=".csv,.json,text/csv,application/json" onChange={(e) => read(e.target.files?.[0])} data-testid="clinic-import-file" /></Field>
        <Preview result={result} />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="clinic-import-cancel">Cancel</Button>
          <Button onClick={submit} disabled={!result || result.errors.length > 0} data-testid="clinic-import-submit">Import Clinics</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
