import { StatusBadge } from "@/components/common/StatusBadge";

export function CaseFlags({ c }) {
  return (
    <>
      <StatusBadge kind="flag" value={c.attentionStatus || "active"} />
      {c.overdue && c.status !== "removed" && <StatusBadge kind="flag" value="overdue" />}
      {c.completionReviewStatus === "pending" && <StatusBadge kind="flag" value="awaiting" />}
      {c.overdueReasonRequired && <StatusBadge kind="flag" value="reason" />}
    </>
  );
}
