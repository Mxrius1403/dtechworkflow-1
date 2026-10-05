import { NavLink } from "react-router-dom";
import { LogOut } from "lucide-react";
import { APP_NAME, LOGO } from "@/config/constants";
import { navItemsFor } from "@/config/navigation";
import { useSession } from "@/context/SessionContext";
import { cn } from "@/lib/utils";

const roleName = (u) => (u.isOwner ? "Owner" : u.isManager ? "Manager" : "Technician");

export function Sidebar({ onNavigate }) {
  const { user, signOut } = useSession();
  return (
    <div className="flex h-full flex-col gap-5 p-4">
      <div className="flex items-center gap-2 px-1">
        <img src={LOGO} alt="Dentaltech Group" className="h-11 w-11 object-cover object-left" />
        <span className="text-lg font-extrabold text-primary" style={{ fontFamily: "Plus Jakarta Sans" }}>{APP_NAME}</span>
      </div>
      <div className="rounded-xl border bg-muted/50 px-3 py-2.5" data-testid="sidebar-user-box">
        <p className="truncate text-sm font-semibold text-primary">{user.name}</p>
        <p className="font-mono text-[11px] text-muted-foreground">{user.id} • {roleName(user)}</p>
      </div>
      <nav className="grid gap-1" data-testid="sidebar-nav">
        {navItemsFor(user).map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            onClick={onNavigate}
            className={({ isActive }) => cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-primary",
            )}
            data-testid={`nav-${path.slice(1)}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </NavLink>
        ))}
      </nav>
      <button onClick={signOut} className="mt-auto flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-700" data-testid="sidebar-signout">
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}
