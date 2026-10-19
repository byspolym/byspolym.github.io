import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/input";
import { useHub } from "@/lib/hub";
import { AuthFrame } from "./login";

export const Route = createFileRoute("/reset-password")({ component: Page });

function Page() {
  const hub = useHub();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <AuthFrame title="Choose a new password">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await hub.updatePassword(password);
            await nav({ to: "/hub" });
          } catch (ex) {
            setErr(ex instanceof Error ? ex.message : "Could not update password");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <FieldLabel>New password</FieldLabel>
          <Input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          Save password
        </Button>
      </form>
    </AuthFrame>
  );
}
