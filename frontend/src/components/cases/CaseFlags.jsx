import { StatusBadge } from "@/components/common/StatusBadge";

export function CaseFlags({ c }) {
  return (
    <>
      {c.overdue && c.status !== "removed" && <StatusBadge kind="flag" value="overdue" />}
      {c.attentionStatus === "on_hold" && <StatusBadge kind="flag" value="on_hold" />}
      {c.attentionStatus === "need_information" && <StatusBadge kind="flag" value="need_information" />}
      {c.completionReviewStatus === "pending" && <StatusBadge kind="flag" value="awaiting" />}
      {c.overdueReasonRequired && <StatusBadge kind="flag" value="reason" />}
    </>
  );
}
