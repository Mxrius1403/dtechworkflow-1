import { cn } from "@/lib/utils";

const ACCENTS = {
  default: "before:bg-slate-300",
  teal: "before:bg-[#0097a7]",
  amber: "before:bg-amber-400",
  indigo: "before:bg-indigo-500",
  rose: "before:bg-rose-500",
  emerald: "before:bg-emerald-500",
  sky: "before:bg-sky-500",
};

export function StatCard({ label, value, hint, accent = "default", testId, className }) {
  return (
    <div
      className={cn(
        "lift relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm before:absolute before:inset-y-0 before:left-0 before:w-1",
        ACCENTS[accent], className,
      )}
      data-testid={testId}
    >
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold text-primary sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 truncate text-xs text-muted-foreground" title={hint}>{hint}</p>}
    </div>
  );
}

export function StatGrid({ children, cols = 5, className }) {
  const grid = { 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5" }[cols];
  return <div className={cn("grid grid-cols-2 gap-3 sm:gap-4", grid, className)}>{children}</div>;
}
