import { useState } from "react";
import { Menu, MonitorPlay, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useSession } from "@/context/SessionContext";
import { niceToday } from "@/lib/format";
import { AccountDialog } from "./AccountDialog";
import { Sidebar } from "./Sidebar";

export function TopBar({ title, onTvMode }) {
  const { user } = useSession();
  const [menu, setMenu] = useState(false);
  const [account, setAccount] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenu(true)} data-testid="mobile-menu-button"><Menu /></Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold text-primary sm:text-2xl" data-testid="page-title">{title}</h1>
          <p className="text-xs text-muted-foreground">{niceToday()}</p>
        </div>
      </div>
      {user.isManager && (
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={onTvMode} className="hidden sm:inline-flex" data-testid="tv-mode-button"><MonitorPlay /> TV Mode</Button>
          <Button variant="outline" size="sm" onClick={() => setAccount(true)} data-testid="account-button"><UserCog /> <span className="hidden sm:inline">Account</span></Button>
        </div>
      )}
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar onNavigate={() => setMenu(false)} />
        </SheetContent>
      </Sheet>
      {account && <AccountDialog onClose={() => setAccount(false)} />}
    </header>
  );
}
