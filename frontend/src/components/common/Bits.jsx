import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackLink({ to, children, testId = "back-link" }) {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1 text-muted-foreground" data-testid={testId}>
      <Link to={to}><ArrowLeft /> {children}</Link>
    </Button>
  );
}

export function Muted({ children, className = "" }) {
  return <p className={`py-3 text-sm text-muted-foreground ${className}`}>{children}</p>;
}

export function Notice({ children, tone = "info", testId }) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    secure: "border-teal-200 bg-teal-50 text-teal-900",
  };
  return <div className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${tones[tone]}`} data-testid={testId}>{children}</div>;
}
