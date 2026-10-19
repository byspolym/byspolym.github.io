import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/input";
import { useHub } from "@/lib/hub";
import { AuthFrame } from "./login";

export const Route = createFileRoute("/forgot-password")({ component: Page });

function Page() {
  const hub = useHub();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <AuthFrame title="Reset password">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          setMsg(null);
          try {
            await hub.requestReset(email);
            setMsg(
              hub.backend === "supabase"
                ? "If that email is registered, a reset link is on its way."
                : "Password reset email is available once the live campus database is connected. Contact ICT if you are locked out.",
            );
          } catch (ex) {
            setErr(ex instanceof Error ? ex.message : "Could not send reset");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <FieldLabel>Email</FieldLabel>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        {msg && <p className="text-sm text-forest">{msg}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          Send reset link
        </Button>
      </form>
      <Link to="/login" className="mt-4 inline-block text-sm text-primary hover:underline">
        Back to sign in
      </Link>
    </AuthFrame>
  );
}
