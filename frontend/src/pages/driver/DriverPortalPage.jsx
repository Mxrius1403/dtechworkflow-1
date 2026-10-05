import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LOGO } from "@/config/constants";
import { useData } from "@/context/DataContext";
import { useSession } from "@/context/SessionContext";
import { nice } from "@/lib/format";
import { defaultDriverDate } from "@/lib/logistics";
import { DriverMission } from "./DriverMission";
import { Card } from "./DriverParts";
import { WorkWeek } from "./WorkWeek";

/** Mobile driver app: pick a day of the work week, then follow that day's mission step by step. */
export default function DriverPortalPage() {
  const { routes } = useData();
  const { driver, signOut } = useSession();
  const [date, setDate] = useState(defaultDriverDate);
  const assigned = routes.filter((r) => r.driverUid === driver.uid);
  const route = assigned.filter((r) => r.date === date).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];

  return (
    <div className="min-h-screen bg-background grid-dots">
      <div className="mx-auto flex max-w-xl flex-col gap-4 p-4 pb-12 sm:p-6" data-testid="driver-portal">
        <header className="flex items-center justify-between gap-3">
          <div>
            <img src={LOGO} alt="Dentaltech Group" className="-ml-1 h-12 w-auto object-contain" />
            <p className="text-xs text-muted-foreground" data-testid="driver-identity">{driver.name} • {driver.id}</p>
          </div>
          <Button variant="outline" size="sm" onClick={signOut} data-testid="driver-signout"><LogOut /> Sign out</Button>
        </header>
        <WorkWeek date={date} routes={assigned} onSelect={setDate} />
        {route ? <DriverMission key={route.id} route={route} /> : (
          <Card className="py-10 text-center" testId="driver-no-mission">
            <h2 className="text-xl font-bold text-primary">No mission scheduled</h2>
            <p className="mt-1 text-sm text-muted-foreground">There is no route assigned for {nice(date)}.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
