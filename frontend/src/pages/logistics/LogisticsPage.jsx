import { MapPin, Route } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { defaultDriverDate } from "@/lib/logistics";
import { CreateRouteTab } from "./CreateRouteTab";
import { LogisticsStats } from "./LogisticsStats";
import { ReadyCasesPanel } from "./ReadyCasesPanel";
import { RoutesTab } from "./RoutesTab";
import { useRouteDraft } from "./useRouteDraft";

const TABS = [["routes", "Routes", MapPin], ["create", "Create Route", Route]];

/** Deliveries & Collections: ready cases, route building and live routes. */
export default function LogisticsPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([key]) => key === params.get("tab")) ? params.get("tab") : "routes";
  const setTab = (key) => setParams({ tab: key });
  const draft = useRouteDraft();
  const [routesDate, setRoutesDate] = useState(defaultDriverDate);

  return (
    <>
      <LogisticsStats />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start" data-testid="logistics-tabs">
          {TABS.map(([key, label, Icon]) => (
            <TabsTrigger key={key} value={key} className="gap-1.5 px-3 py-1.5" data-testid={`logistics-tab-${key}`}><Icon className="h-4 w-4" /> {label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {(tab === "routes" || tab === "create") && <ReadyCasesPanel draft={draft} onAdded={() => setTab("create")} />}
      {tab === "routes" && <RoutesTab date={routesDate} onDateChange={setRoutesDate} />}
      {tab === "create" && <CreateRouteTab draft={draft} onPublished={(date) => { setRoutesDate(date); setTab("routes"); }} />}
    </>
  );
}
