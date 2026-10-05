import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({ label, hint, children, className }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label className="text-xs font-semibold text-foreground/80">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50";

/** items: [[value, label]] — text goes in the label attribute so <option> never gets element children. */
export const Options = ({ items }) => items.map(([value, label]) => <option key={value} value={value} label={label} />);

export function NativeSelect({ className, children, ...props }) {
  return <select className={cn(selectClass, className)} {...props}>{children}</select>;
}
