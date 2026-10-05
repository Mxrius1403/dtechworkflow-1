import { cn } from "@/lib/utils";

export function Panel({ title, description, eyebrow, actions, children, className, ...rest }) {
  const hasHead = title || description || actions || eyebrow;
  return (
    <section className={cn("fade-up rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:p-5", className)} {...rest}>
      {hasHead && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
            {title && <h2 className="text-base font-bold text-primary md:text-lg">{title}</h2>}
            {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
