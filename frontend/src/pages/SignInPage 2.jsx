import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, Truck, UserRound } from "lucide-react";
import { APP_NAME, LOGO } from "@/config/constants";
import { useData } from "@/context/DataContext";
import { useSession } from "@/context/SessionContext";
import { departmentName } from "@/lib/cases";

const roleLabel = (u) => (u.role === "owner" ? "Owner" : u.role === "manager" ? "Manager" : `${departmentName(u.department)} Technician`);

function PersonaButton({ title, subtitle, code, onClick, testId }) {
  return (
    <button onClick={onClick} className="lift group flex w-full items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-left hover:border-secondary" data-testid={testId}>
      <div className="min-w-0">
        <p className="truncate font-semibold text-primary">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <span className="flex items-center gap-2">
        <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">{code}</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-secondary" />
      </span>
    </button>
  );
}

/** Starting screen. Phase 1 has no passwords: choose a demo account to open its role-based workspace. */
export default function SignInPage() {
  const { users, drivers } = useData();
  const { user, driver, signIn } = useSession();
  const navigate = useNavigate();
  if (user) return <Navigate to="/dashboard" replace />;
  if (driver) return <Navigate to="/driver" replace />;

  const enter = (kind, id) => {
    signIn({ kind, id });
    navigate(kind === "driver" ? "/driver" : "/dashboard");
  };
  const staff = users.filter((u) => u.active);

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-white lg:flex">
        <div className="absolute inset-0 opacity-20 grid-dots" />
        <div className="relative">
          <p className="eyebrow !text-teal-200">Dentaltech Group</p>
          <h1 className="mt-4 max-w-md text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">Production, quality and logistics in one flow.</h1>
          <p className="mt-5 max-w-md text-base text-white/70">Receiving, production boards, completion review, reports, orders, holidays, routes and clinic tracking — for the whole lab team.</p>
        </div>
        <p className="relative text-xs text-white/50">{APP_NAME} • read-only demo data • Phase 1</p>
      </aside>
      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="fade-up w-full max-w-md">
          <img src={LOGO} alt="Dentaltech Group" className="-ml-3 mb-2 h-24 w-auto object-contain" />
          <h2 className="text-2xl font-bold text-primary">Dental Tech Daily</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose a demo account to sign in. No password is needed in this preview.</p>

          <p className="eyebrow mb-2 mt-8 flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> Lab team</p>
          <div className="grid gap-2" data-testid="signin-staff-list">
            {staff.map((u) => <PersonaButton key={u.id} title={u.name} subtitle={roleLabel(u)} code={u.id} onClick={() => enter("staff", u.id)} testId={`signin-staff-${u.id.toLowerCase()}`} />)}
          </div>

          <p className="eyebrow mb-2 mt-6 flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Driver portal</p>
          <div className="grid gap-2" data-testid="signin-driver-list">
            {drivers.filter((d) => d.active).map((d) => <PersonaButton key={d.id} title={d.name} subtitle="Deliveries & Collections" code={d.id} onClick={() => enter("driver", d.id)} testId={`signin-driver-${d.id.toLowerCase()}`} />)}
          </div>
        </div>
      </main>
    </div>
  );
}
