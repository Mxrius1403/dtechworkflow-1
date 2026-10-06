import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { Field } from "@/components/common/Field";
import { FullScreenMessage } from "@/components/common/FullScreenMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APP_NAME, LOGO } from "@/config/constants";
import { useSession } from "@/context/SessionContext";

export default function SignInPage() {
  const { user, loading, error: sessionError, signIn } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <FullScreenMessage title="Dental Tech Daily" text="Checking your sign-in…" loading />;
  if (sessionError) return <FullScreenMessage title="Sign-in unavailable" text="The authentication service could not be reached. Check the connection and retry." action={{ label: "Retry", onClick: () => window.location.reload() }} />;
  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await signIn({ email, password });
      navigate("/dashboard");
    } catch (loginError) {
      setError(loginError.response?.data?.detail || "Unable to sign in. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-white lg:flex">
        <div className="absolute inset-0 opacity-20 grid-dots" />
        <div className="relative">
          <p className="eyebrow !text-teal-200">Dentaltech Group</p>
          <h1 className="mt-4 max-w-md text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">Production, quality and logistics in one flow.</h1>
          <p className="mt-5 max-w-md text-base text-white/70">Receiving, production boards, completion review, reports, orders, holidays, routes and clinic tracking — for the whole lab team.</p>
        </div>
        <p className="relative text-xs text-white/50">{APP_NAME} • secure staff access</p>
      </aside>
      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="fade-up w-full max-w-md">
          <img src={LOGO} alt="Dentaltech Group" className="-ml-3 mb-2 h-24 w-auto object-contain" />
          <h2 className="text-2xl font-bold text-primary">Dental Tech Daily</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sign in with your staff account.</p>
          <form className="mt-8 grid gap-4" onSubmit={submit} data-testid="signin-form">
            <Field label="Email">
              <Input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} data-testid="signin-email" />
            </Field>
            <Field label="Password">
              <Input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} data-testid="signin-password" />
            </Field>
            {error && <p role="alert" className="text-sm font-medium text-destructive" data-testid="signin-error">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting} data-testid="signin-submit">
              <LockKeyhole className="mr-2 h-4 w-4" /> {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
