import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect, Options } from "@/components/common/Field";
import { useData } from "@/context/DataContext";
import { finishRoute, reportStopProblem } from "@/lib/api";
import { STOP_PROBLEM_REASONS, stopJobs, stopProblemValid } from "@/lib/logistics";
import { notify, notifyError } from "@/lib/notify";
import { useRouteCache } from "./routeCache";

const NOTE_MAX = 200;
const EMPTY = { reason: "", note: "" };

function StopProblemFields({ value, onChange, testId }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Reason">
        <NativeSelect value={value.reason} onChange={(e) => onChange({ ...value, reason: e.target.value })} data-testid={`${testId}-reason`}>
          <option value="" label="Choose a reason" disabled />
          <Options items={STOP_PROBLEM_REASONS} />
        </NativeSelect>
      </Field>
      <Field label={`Note (${value.reason === "other" ? "required" : "optional"})`}>
        <Input value={value.note} maxLength={NOTE_MAX} onChange={(e) => onChange({ ...value, note: e.target.value })} placeholder="e.g. back open at 2pm" data-testid={`${testId}-note`} />
      </Field>
    </div>
  );
}

// Closes as soon as the server has saved; the full reload carries on in the background.
function useSubmit(onClose) {
  const cache = useRouteCache();
  const [saving, setSaving] = useState(false);
  const submit = async (request, message, failure, apply) => {
    setSaving(true);
    try {
      const result = await request();
      apply(cache, result);
      cache.refresh();
      notify(message);
      onClose();
    } catch (error) {
      const detail = error.response?.data?.detail;
      notifyError(typeof detail === "string" ? detail : failure);
    } finally {
      setSaving(false);
    }
  };
  return [saving, submit];
}

const clean = ({ reason, note }) => ({ reason, note: note.trim() });

/** Driver tells the managers straight away that a stop cannot be completed. */
export function ReportProblemDialog({ route, stop, onClose }) {
  const { byId } = useData();
  const [problem, setProblem] = useState(stop.problem ? { reason: stop.problem.reason, note: stop.problem.note || "" } : EMPTY);
  const [saving, submit] = useSubmit(onClose);
  const clinic = byId.clinics[stop.clinicId]?.name || stop.clinicId;
  const save = () => {
    if (!stopProblemValid(problem)) return notifyError(problem.reason ? "Describe the problem" : "Choose a reason");
    return submit(() => reportStopProblem(route.id, stop.id, clean(problem)), "Problem reported to the managers", "Could not report the problem",
      (cache, result) => cache.patchStop(stop.id, { problem: result.problem }));
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg" data-testid="report-problem-dialog">
        <DialogHeader>
          <DialogTitle>Report a problem</DialogTitle>
          <DialogDescription>{clinic} • {stopJobs(stop) || "No jobs"}. The managers get a message straight away.</DialogDescription>
        </DialogHeader>
        <StopProblemFields value={problem} onChange={setProblem} testId="report-problem" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} data-testid="report-problem-save">{saving ? "Sending…" : "Send to managers"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Finishing with open stops: the driver gives a reason for each one so the managers can follow up. */
export function FinishRouteDialog({ route, openStops, onClose }) {
  const { byId } = useData();
  const [problems, setProblems] = useState(() => Object.fromEntries(openStops.map((s) => [
    s.id, s.problem ? { reason: s.problem.reason, note: s.problem.note || "" } : EMPTY,
  ])));
  const [saving, submit] = useSubmit(onClose);
  const save = () => {
    if (!openStops.every((s) => stopProblemValid(problems[s.id]))) return notifyError("Give a reason for every open stop");
    const payload = Object.fromEntries(Object.entries(problems).map(([id, p]) => [id, clean(p)]));
    return submit(() => finishRoute(route.id, payload), "Route finished. The managers have been told.", "Could not finish the route",
      (cache) => cache.patchRoute(route.id, { status: "completed" }));
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="finish-route-dialog">
        <DialogHeader>
          <DialogTitle>Finish route {route.id}</DialogTitle>
          <DialogDescription>
            {openStops.length === 1 ? "1 stop is" : `${openStops.length} stops are`} not done. Their cases will be set to Not Delivered. Tell the managers why, so they can plan the next delivery.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {openStops.map((stop) => (
            <section key={stop.id} className="grid gap-2 rounded-lg border p-3" data-testid={`finish-stop-${stop.id}`}>
              <p className="text-sm font-semibold text-primary">{byId.clinics[stop.clinicId]?.name || stop.clinicId} <span className="font-normal text-muted-foreground">• {stopJobs(stop) || "No jobs"}</span></p>
              <StopProblemFields value={problems[stop.id]} onChange={(p) => setProblems((all) => ({ ...all, [stop.id]: p }))} testId={`finish-stop-${stop.id}`} />
            </section>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Back to route</Button>
          <Button onClick={save} disabled={saving} data-testid="finish-route-confirm">{saving ? "Finishing…" : "Finish route"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
