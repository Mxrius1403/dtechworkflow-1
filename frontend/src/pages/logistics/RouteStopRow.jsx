import { ArrowRightLeft, ExternalLink, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { emailKey, stopJobs, trackingUrl } from "@/lib/logistics";
import { demoSave } from "@/lib/notify";

function EmailButton({ route, stop, planReady }) {
  const { byId, emails } = useData();
  const mail = emails[emailKey(route.id, stop.id)];
  const hasEmail = byId.clinics[stop.clinicId]?.hasEmail;
  const sent = mail?.status === "sent";
  const title = !hasEmail ? "No clinic email on file" : !planReady ? "Wait for the driver to confirm the clinic order" : undefined;
  return (
    <Button size="sm" variant="outline" title={title} disabled={!hasEmail || !planReady || sent} onClick={() => demoSave("Clinic tracking email sent")} data-testid={`stop-email-${stop.id}`}>
      <Mail /> {sent ? "Email sent ✓" : mail?.status === "failed" ? "Retry Tracking Email" : "Send Tracking Email"}
    </Button>
  );
}

export function RouteStopRow({ index, route, stop, planReady, onTransfer }) {
  const { byId } = useData();
  const clinic = byId.clinics[stop.clinicId] || {};
  const token = route.trackingTokens?.[stop.id];
  const transferable = stop.status !== "completed" && !stop.arrived;
  return (
    <div className="rounded-lg border p-3" data-testid={`route-stop-${stop.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-primary">
            <span className="font-mono text-xs text-muted-foreground">{index + 1}.</span> {clinic.name || stop.clinicId}
            {stop.urgent && <StatusBadge kind="flag" value="urgent" />}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {clinic.eircode} • {stopJobs(stop) || "No jobs"} <StatusBadge kind="stop" value={stop.status} testId={`stop-status-${stop.id}`} />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <EmailButton route={route} stop={stop} planReady={planReady} />
          <Button size="sm" variant="outline" disabled={!transferable} onClick={onTransfer} data-testid={`stop-transfer-${stop.id}`}><ArrowRightLeft /> Transfer Stop</Button>
          {token && (
            <Button asChild size="sm" variant="ghost" data-testid={`stop-tracking-link-${stop.id}`}>
              <a href={trackingUrl(token)} target="_blank" rel="noopener noreferrer"><ExternalLink /> Clinic page</a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
