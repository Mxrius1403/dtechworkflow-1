import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LOGO } from "@/config/constants";

export function FullScreenMessage({ title, text, loading, action, children }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background grid-dots p-6">
      <div className="fade-up w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-xl" data-testid="fullscreen-message">
        <img src={LOGO} alt="Dentaltech Group" className="mx-auto mb-5 h-20 w-auto object-contain" />
        <h1 className="text-2xl font-bold text-primary">{title}</h1>
        {text && <p className="mt-2 text-sm text-muted-foreground">{text}</p>}
        {loading && <Loader2 className="mx-auto mt-5 h-5 w-5 animate-spin text-secondary" />}
        {action && <Button className="mt-6" onClick={action.onClick} data-testid="fullscreen-message-action">{action.label}</Button>}
        {children}
      </div>
    </div>
  );
}
