import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useData } from "@/context/DataContext";
import { cn } from "@/lib/utils";

export function Card({ children, className, testId }) {
  return <section className={cn("fade-up rounded-2xl border bg-card p-4 shadow-sm sm:p-5", className)} data-testid={testId}>{children}</section>;
}

/** Navy mission banner at the top of every driver stage. */
export function MissionHero({ title, text, note, children, done, testId = "driver-mission-hero" }) {
  return (
    <section className={cn("fade-up relative overflow-hidden rounded-2xl p-5 text-white shadow-lg", done ? "bg-emerald-700" : "bg-primary")} data-testid={testId}>
      <div className="absolute inset-0 opacity-20 grid-dots" />
      <div className="relative">
        <h1 className="text-2xl font-extrabold sm:text-3xl" data-testid="driver-mission-title">{title}</h1>
        {text && <p className="mt-1 text-sm text-white/80">{text}</p>}
        {note && <p className="mt-2 text-xs font-medium text-teal-200">{note}</p>}
        {children && <div className="mt-4">{children}</div>}
      </div>
    </section>
  );
}

export function BigAction({ className, ...props }) {
  return <Button className={cn("h-14 w-full rounded-xl bg-secondary text-base font-extrabold tracking-wide hover:bg-secondary/90", className)} {...props} />;
}

export function DriverAlert({ title, text, action, testId }) {
  return (
    <div className="fade-up rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950" data-testid={testId}>
      <p className="font-bold">{title}</p>
      <p className="mt-0.5 text-sm">{text}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function RouteTimeline({ stops, current }) {
  const { byId } = useData();
  return (
    <ol className="grid gap-2" data-testid="driver-timeline">
      {stops.map((s, i) => {
        const done = s.status === "completed", now = s.id === current?.id;
        return (
          <li key={s.id} className={cn("flex items-start gap-3 rounded-xl border p-3", now && "border-secondary bg-accent/50", done && "opacity-70")} data-testid={`timeline-stop-${s.id}`}>
            <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-xs font-bold", done ? "bg-emerald-500 text-white" : now ? "bg-secondary text-white" : "bg-muted text-primary")}>
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-primary">{byId.clinics[s.clinicId]?.name}</p>
              <p className="text-xs text-muted-foreground">{s.deliveries?.length || 0} deliveries • {s.collections?.length || 0} collections • {s.status}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
