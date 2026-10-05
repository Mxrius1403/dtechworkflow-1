import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { CaseDialogsProvider } from "@/components/cases/CaseDialogsProvider";
import { pageForPath, pageTitle } from "@/config/navigation";
import { useSession } from "@/context/SessionContext";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { TvBoard } from "./TvBoard";

export function AppShell() {
  const { user } = useSession();
  const { pathname } = useLocation();
  const [tv, setTv] = useState(false);
  const title = pageTitle(pageForPath(pathname), user);

  const toggleTv = useCallback(() => {
    setTv((on) => {
      if (on) document.exitFullscreen?.().catch(() => {});
      else document.documentElement.requestFullscreen?.().catch(() => {});
      return !on;
    });
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && tv && toggleTv();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tv, toggleTv]);

  return (
    <CaseDialogsProvider>
      {tv ? <TvBoard onExit={toggleTv} /> : (
        <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
          <aside className="sticky top-0 hidden h-screen border-r bg-card lg:block"><Sidebar /></aside>
          <div className="min-w-0">
            <TopBar title={title} onTvMode={toggleTv} />
            <main className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8" key={pathname}>
              <Outlet />
            </main>
          </div>
        </div>
      )}
    </CaseDialogsProvider>
  );
}
