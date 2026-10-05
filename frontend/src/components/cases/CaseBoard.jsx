import { CountPill } from "@/components/common/StatusBadge";
import { cn } from "@/lib/utils";

export function CaseColumn({ title, items, renderCard, testId, className }) {
  return (
    <section className={cn("flex min-h-[220px] flex-col rounded-xl border bg-muted/40 p-3", className)} data-testid={testId}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{title}</h3>
        <CountPill testId={testId && `${testId}-count`}>{items.length}</CountPill>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {items.map(renderCard)}
        {!items.length && <p className="py-6 text-center text-xs text-muted-foreground">No cases</p>}
      </div>
    </section>
  );
}

export function CaseBoard({ queue, production, completed, renderCard, testId, className }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-3", className)}>
      <CaseColumn title="In Queue" items={queue} renderCard={renderCard} testId={`${testId}-queue`} />
      <CaseColumn title="In Production" items={production} renderCard={renderCard} testId={`${testId}-production`} />
      <CaseColumn title="Completed" items={completed} renderCard={renderCard} testId={`${testId}-completed`} />
    </div>
  );
}

export const splitByStatus = (cases) => ({
  queue: cases.filter((c) => c.status === "queue"),
  production: cases.filter((c) => c.status === "production"),
  completed: cases.filter((c) => c.status === "completed"),
});
