import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/common/Bits";
import { DataTable } from "@/components/common/DataTable";
import { Panel } from "@/components/common/Panel";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { StaffDialog } from "@/pages/technicians/StaffDialog";

export default function DriversPage() {
  const { drivers, settings } = useData();
  const [editing, setEditing] = useState(null);
  const rows = [...drivers].sort((a, b) => a.id.localeCompare(b.id));
  return (
    <>
      <BackLink to="/delivery-management">Delivery Management</BackLink>
      <Panel
        title="Drivers"
        description="Driver passwords and emails are handled by the sign-in provider; they are never stored in plain text in the database."
        actions={<Button onClick={() => setEditing({})} data-testid="driver-add-button"><Plus /> Add Driver</Button>}
      >
        <DataTable testId="drivers-table" rows={rows} rowTestId={(d) => `driver-row-${d.id}`} empty="No drivers yet." columns={[
          { key: "id", header: "ID", render: (d) => <span className="font-mono font-bold">{d.id}</span> },
          { key: "name", header: "Name" },
          { key: "status", header: "Status", render: (d) => <StatusBadge kind="account" value={d.active !== false ? "active" : "inactive"} /> },
          { key: "security", header: "Security", render: () => <StatusBadge kind="flag" value="protected" /> },
          { key: "edit", header: "", render: (d) => <Button size="sm" variant="outline" onClick={() => setEditing(d)} data-testid={`driver-edit-${d.id}`}>Edit</Button> },
        ]} />
        {editing && <StaffDialog kind="driver" person={editing.id ? editing : null} nextId={`D${String(settings.nextDriverNumber || 1).padStart(4, "0")}`} onClose={() => setEditing(null)} />}
      </Panel>
    </>
  );
}
