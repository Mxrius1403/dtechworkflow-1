import { Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MaterialCard({ p, supplier, favourite, onFavourite, onAdd }) {
  return (
    <div className="lift relative flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm" data-testid={`material-card-${p.id}`}>
      <button onClick={() => onFavourite(p.id)} title="Favourite" className="absolute right-3 top-3 rounded-md p-1 transition-colors hover:bg-amber-50" data-testid={`material-favourite-${p.id}`}>
        <Star className={cn("h-4 w-4", favourite ? "fill-amber-400 text-amber-500" : "text-muted-foreground")} />
      </button>
      <p className="min-w-0 truncate pr-8 font-mono text-xs font-semibold text-secondary" title={p.refNo}>{p.refNo}</p>
      <h3 className="min-w-0 truncate text-sm font-bold leading-snug text-primary" title={p.title}>{p.title}</h3>
      <p className="min-w-0 truncate text-xs text-muted-foreground" title={`Producer: ${p.producer}`}>Producer: {p.producer}</p>
      <div className="flex min-w-0 flex-wrap gap-1">
        {[supplier || "Supplier unavailable", [p.quantity, p.unit, p.measure].filter(Boolean).join(" ")].filter(Boolean).map((item) => (
          <span key={item} className="min-w-0 max-w-full truncate rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground" title={item}>{item}</span>
        ))}
      </div>
      <Button size="sm" className="mt-auto" onClick={() => onAdd(p.id)} data-testid={`material-add-${p.id}`}><Plus /> Add to Order</Button>
    </div>
  );
}

export function MaterialGrid({ title, products, suppliers, favourites, onFavourite, onAdd, testId, empty }) {
  return (
    <section className="fade-up rounded-xl border bg-card p-4 shadow-sm sm:p-5" data-testid={testId}>
      <h2 className="mb-4 text-base font-bold text-primary md:text-lg">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {products.map((p) => <MaterialCard key={p.id} p={p} supplier={suppliers[p.supplierId]} favourite={favourites.includes(p.id)} onFavourite={onFavourite} onAdd={onAdd} />)}
      </div>
      {!products.length && <p className="py-3 text-sm text-muted-foreground">{empty}</p>}
    </section>
  );
}
