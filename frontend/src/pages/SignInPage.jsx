import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LockKeyhole, UserRoundPlus } from "lucide-react";
import { Field } from "@/components/common/Field";
import { FullScreenMessage } from "@/components/common/FullScreenMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APP_NAME, LOGO } from "@/config/constants";
import { useSession } from "@/context/SessionContext";

export default function SignInPage() {
  const { user, loading, error: sessionError, setupRequired, signIn, createOwner } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
      if (setupRequired) {
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }
        await createOwner({ name, email, password });
      } else {
        await signIn({ email, password });
      }
      navigate("/dashboard");
    } catch (loginError) {
      setError(loginError.response?.data?.detail || (setupRequired
        ? "Unable to create the owner account. Check your connection and try again."
        : "Unable to sign in. Check your connection and try again."));
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
          <p className="mt-1 text-sm text-muted-foreground">
            {setupRequired ? "Create the owner account to finish setting up your workspace." : "Sign in with your staff account."}
          </p>
          <form className="mt-8 grid gap-4" onSubmit={submit} data-testid={setupRequired ? "owner-setup-form" : "signin-form"}>
            {setupRequired && (
              <Field label="Name">
                <Input type="text" autoComplete="name" required minLength={1} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} data-testid="owner-setup-name" />
              </Field>
            )}
            <Field label="Email">
              <Input type="email" autoComplete={setupRequired ? "email" : "username"} required value={email} onChange={(event) => setEmail(event.target.value)} data-testid={setupRequired ? "owner-setup-email" : "signin-email"} />
            </Field>
            <Field label="Password">
              <Input type="password" autoComplete={setupRequired ? "new-password" : "current-password"} required minLength={setupRequired ? 12 : undefined} maxLength={setupRequired ? 72 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} data-testid={setupRequired ? "owner-setup-password" : "signin-password"} />
            </Field>
            {setupRequired && (
              <Field label="Confirm password">
                <Input type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} data-testid="owner-setup-confirm-password" />
              </Field>
            )}
            {error && <p role="alert" className="text-sm font-medium text-destructive" data-testid="signin-error">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting} data-testid={setupRequired ? "owner-setup-submit" : "signin-submit"}>
              {setupRequired ? <UserRoundPlus className="mr-2 h-4 w-4" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
              {submitting ? (setupRequired ? "Creating account…" : "Signing in…") : (setupRequired ? "Create owner account" : "Sign in")}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
