import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { COMPANY, LOGO } from "@/config/constants";
import { fetchTracking } from "@/lib/api";
import { LiveMap, TrackingDetails } from "./TrackingDetails";

const TOKEN = /^[a-f0-9]{48}$/;
const UNAVAILABLE = "This tracking link is unavailable or has expired.";

function Shell({ children }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background grid-dots p-3 sm:p-6">
      <div className="fade-up w-full max-w-[680px] rounded-2xl border bg-card p-5 shadow-xl sm:p-7" data-testid="tracking-card">{children}</div>
    </main>
  );
}

function Problem({ message }) {
  return (
    <Shell>
      <div className="py-6 text-center" data-testid="tracking-error">
        <img src={LOGO} alt={COMPANY} className="mx-auto mb-4 h-16 w-auto object-contain" />
        <h1 className="text-2xl font-bold text-primary">Tracking unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground" data-testid="tracking-error-message">{message}</p>
      </div>
    </Shell>
  );
}

function errorMessage(error) {
  const status = error?.response?.status;
  if (status === 400) return "The tracking link is invalid.";
  if ([401, 403, 404].includes(status)) return UNAVAILABLE;
  return "The tracking information could not be loaded. Please try again shortly.";
}

/** Public clinic page (/track?token=…): no sign-in, refreshes every 5 seconds. */
export default function TrackingPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const valid = TOKEN.test(token);
  const q = useQuery({ queryKey: ["tracking", token], queryFn: () => fetchTracking(token), enabled: valid, refetchInterval: 5000, refetchOnWindowFocus: true, retry: false, staleTime: 0 });

  if (!valid) return <Problem message="The tracking link is invalid." />;
  if (q.isPending) return <Shell><p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading tracking information…</p></Shell>;
  if (q.isError && !q.data) return <Problem message={errorMessage(q.error)} />;
  const d = q.data;
  if (d.active === false || !(Number(d.expiresAtMs) > Date.now())) return <Problem message={UNAVAILABLE} />;
  return (
    <Shell>
      <header className="flex items-center gap-4 border-b pb-4">
        <img src={LOGO} alt={COMPANY} className="h-14 w-auto max-w-[45vw] object-contain" />
        <div>
          <h1 className="text-xl font-bold text-primary">{d.companyName || COMPANY}</h1>
          <p className="text-sm text-muted-foreground">Collection & delivery tracking</p>
        </div>
      </header>
      <TrackingDetails d={d} />
      <LiveMap d={d} />
    </Shell>
  );
}
