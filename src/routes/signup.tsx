import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/input";
import { DEPARTMENTS, LEVELS, ROLES } from "@/lib/constants";
import { useHub } from "@/lib/hub";
import type { Role } from "@/lib/types";
import { AuthFrame } from "./login";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const hub = useHub();
  const nav = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "student" as Role,
    department: DEPARTMENTS[0],
    level: "ND I",
    student_id: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <AuthFrame title="Create a campus account">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          setInfo(null);
          try {
            const res = await hub.signUp({
              ...form,
              department: form.department,
            });
            if (res.needsConfirm) {
              setInfo("Check your email to confirm this account, then sign in.");
              return;
            }
            await nav({ to: "/hub" });
          } catch (ex) {
            setErr(ex instanceof Error ? ex.message : "Could not create account");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <FieldLabel>Full name</FieldLabel>
          <Input required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
        </div>
        <div>
          <FieldLabel>Email</FieldLabel>
          <Input type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div>
          <FieldLabel>Password</FieldLabel>
          <Input type="password" required minLength={8} value={form.password} onChange={(e) => set("password", e.target.value)} />
        </div>
        <div>
          <FieldLabel>I am</FieldLabel>
          <select
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
            value={form.role}
            onChange={(e) => set("role", e.target.value)}
          >
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Department</FieldLabel>
            <select
              className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Level</FieldLabel>
            <select
              className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={form.level}
              onChange={(e) => set("level", e.target.value)}
            >
              {LEVELS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <FieldLabel>Student / staff ID</FieldLabel>
          <Input value={form.student_id} onChange={(e) => set("student_id", e.target.value)} placeholder="BYS/CS/ND2/24xxx" />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        {info && <p className="text-sm text-forest">{info}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">
        Already registered?{" "}
        <Link to="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthFrame>
  );
}
