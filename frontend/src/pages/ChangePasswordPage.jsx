import { useState } from "react";
import { KeyRound, LogOut } from "lucide-react";
import { Field } from "@/components/common/Field";
import { FullScreenMessage } from "@/components/common/FullScreenMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/context/SessionContext";
import { notify } from "@/lib/notify";

export default function ChangePasswordPage() {
  const { user, changePassword, signOut } = useSession();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (password.length < 12) return setError("Your new password must be at least 12 characters.");
    if (password !== confirmPassword) return setError("The passwords do not match. Please type them again.");
    setSubmitting(true);
    try {
      await changePassword(password);
      notify("Your password has been changed.");
    } catch (changeError) {
      setError(changeError.response?.data?.detail || "Could not change your password. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FullScreenMessage title="Choose your own password" text={`Welcome, ${user.name}. Your password was set by a manager. Please choose a new one that only you know.`}>
      <form className="mt-6 grid gap-4 text-left" onSubmit={submit} data-testid="change-password-form">
        <input type="email" autoComplete="username" value={user.email} readOnly hidden />
        <Field label="New password" hint="At least 12 characters.">
          <Input type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} data-testid="change-password-new" />
        </Field>
        <Field label="Repeat new password">
          <Input type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} data-testid="change-password-confirm" />
        </Field>
        {error && <p role="alert" className="text-sm font-medium text-destructive" data-testid="change-password-error">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting} data-testid="change-password-submit">
          <KeyRound className="mr-2 h-4 w-4" />
          {submitting ? "Saving…" : "Save new password"}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={signOut} data-testid="change-password-signout">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </form>
    </FullScreenMessage>
  );
}
