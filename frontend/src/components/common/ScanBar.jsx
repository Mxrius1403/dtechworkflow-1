import { useState } from "react";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Barcode scanner input: scanners type the code and press Enter. */
export function ScanBar({ placeholder, buttonLabel = "Scan", onScan, hint, testId = "scan", className }) {
  const [value, setValue] = useState("");
  const submit = () => {
    const v = value;
    setValue("");
    onScan(v);
  };
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border-2 border-secondary bg-card px-3 py-1.5 shadow-sm transition-shadow focus-within:shadow-[0_0_0_4px_hsl(186_100%_33%/0.15)]">
        <ScanLine className="h-5 w-5 shrink-0 text-secondary" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={placeholder}
          className="h-10 min-w-0 flex-1 bg-transparent font-mono text-lg font-semibold tracking-wide outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:tracking-normal"
          data-testid={`${testId}-input`}
        />
        <Button onClick={submit} className="bg-secondary hover:bg-secondary/90" data-testid={`${testId}-button`}>{buttonLabel}</Button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
