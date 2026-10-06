import { MoreVertical } from "lucide-react";
import { useData } from "@/context/DataContext";
import { caseWho, scheduledKey, serviceLabel } from "@/lib/cases";
import { nice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CaseFlags } from "./CaseFlags";

const EDGE = { queue: "border-l-slate-300", production: "border-l-[#0097a7]", completed: "border-l-emerald-500", removed: "border-l-zinc-300" };

/** Compact case card used on every board and list. Pass onClick to make it open a dialog. */
export function CaseCard({ c, onClick, actions, showWho = true, compact }) {
  const { techName } = useData();
  const Tag = onClick ? "button" : "div";
  return (
    <div className={cn("lift min-w-0 rounded-lg border border-l-4 bg-card shadow-sm", EDGE[c.status], c.overdue && c.status !== "completed" && "border-l-rose-500 bg-rose-50/40")} data-testid={`case-card-${c.code}`}>
      <Tag onClick={onClick} className={cn("flex w-full min-w-0 items-start justify-between gap-2 p-3 text-left", onClick && "cursor-pointer")} data-testid={onClick ? `case-card-open-${c.code}` : undefined}>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-sm font-bold text-primary">{c.code}</span>
            <CaseFlags c={c} />
          </div>
          <p className="whitespace-normal break-words text-xs text-muted-foreground" title={serviceLabel(c)}>
            {serviceLabel(c)}{scheduledKey(c) && ` • Due ${nice(scheduledKey(c))}`}
          </p>
          {showWho && !compact && <p className="whitespace-normal break-words text-xs text-foreground/70">{caseWho(c, techName)}</p>}
        </div>
        {onClick && <MoreVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
      </Tag>
      {actions && <div className="flex flex-wrap gap-1.5 border-t px-3 py-2">{actions}</div>}
    </div>
  );
}
