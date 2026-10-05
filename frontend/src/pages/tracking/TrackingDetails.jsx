import { dateTimeOf, nice, timeOf, TIMEZONE } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_LABEL = {
  scheduled: "Visit scheduled", started: "Driver is on route", break: "Route temporarily paused", approaching: "Your clinic is next",
  arrived: "Driver arrived", completed: "Visit completed", problem: "Visit could not be completed",
};

const Box = ({ title, children, testId }) => (
  <div className="rounded-xl border p-4" data-testid={testId}>
    <p className="eyebrow mb-1.5">{title}</p>
    <div className="text-sm font-medium text-foreground">{children}</div>
  </div>
);

export function TrackingDetails({ d }) {
  const completed = d.status === "completed";
  const pct = d.totalStops ? Math.min(100, Math.round((Number(d.completedStops || 0) / Number(d.totalStops)) * 100)) : 0;
  const remaining = Number(d.stopsRemaining || 0);
  return (
    <>
      <section className={cn("my-5 rounded-xl p-4", completed ? "bg-emerald-50" : "bg-accent/60")} data-testid="tracking-status">
        <p className="eyebrow">Status</p>
        <p className="mt-1 text-2xl font-extrabold text-primary" data-testid="tracking-status-label">{STATUS_LABEL[d.status] || STATUS_LABEL.scheduled}</p>
        {completed
          ? d.completedAt && <p className="mt-1 text-sm">Completed at: <b>{timeOf(d.completedAt)}</b></p>
          : d.etaText && <p className="mt-1 text-sm">Estimated arrival: <b data-testid="tracking-eta">{d.etaText}</b></p>}
      </section>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted" data-testid="tracking-progress"><span className="block h-full bg-secondary transition-[width] duration-500" style={{ width: `${pct}%` }} /></div>
      <p className="mt-2 text-sm text-muted-foreground" data-testid="tracking-remaining">
        {completed ? "This visit has been completed." : `${remaining} stop${remaining === 1 ? "" : "s"} remaining before this visit`}
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Box title="Clinic" testId="tracking-clinic">{d.clinicName}</Box>
        <Box title="Visit date" testId="tracking-date">{nice(d.routeDate)}</Box>
        {d.deliveryCases?.length > 0 && <Box title="Cases for delivery" testId="tracking-cases"><ul className="list-disc pl-5 font-mono">{d.deliveryCases.map((c) => <li key={c}>{c}</li>)}</ul></Box>}
        {d.hasCollection && <Box title="Collection" testId="tracking-collection">Please have the collection ready for the driver.</Box>}
      </div>
      <p className="mt-5 text-xs text-muted-foreground" data-testid="tracking-updated">Status updated: {dateTimeOf(d.updatedAt || new Date().toISOString())}</p>
    </>
  );
}

/** OpenStreetMap embed while the driver's last GPS ping is under 2 minutes old. */
export function LiveMap({ d }) {
  const lat = Number(d.driverLat), lng = Number(d.driverLng), age = Date.now() - Number(d.locationUpdatedAt || 0);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || age < 0 || age >= 120000 || d.status === "completed") return null;
  const bbox = [lng - 0.008, lat - 0.006, lng + 0.008, lat + 0.006].join("%2C");
  const updated = new Date(d.locationUpdatedAt).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: TIMEZONE });
  return (
    <section className="mt-5 overflow-hidden rounded-xl border" data-testid="tracking-live-map">
      <div className="flex items-center justify-between px-4 py-3">
        <div><p className="text-sm font-bold text-primary">Live driver location</p><p className="text-xs text-muted-foreground">Updated {updated}</p></div>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700">LIVE</span>
      </div>
      <iframe title="Live driver location" loading="lazy" referrerPolicy="no-referrer" className="block h-[240px] w-full border-0 sm:h-[280px]"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`} />
      <a className="block border-t px-4 py-3 text-sm font-bold text-primary hover:bg-muted/50" href={`https://www.google.com/maps/search/?api=1&query=${lat}%2C${lng}`} target="_blank" rel="noopener noreferrer" data-testid="tracking-map-link">Open location in Maps</a>
    </section>
  );
}
