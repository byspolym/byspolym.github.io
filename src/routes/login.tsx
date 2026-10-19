import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/input";
import { useHub } from "@/lib/hub";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { add: boolean; email: string } => ({
    add: s.add === true || s.add === "1" || s.add === "true",
    email: typeof s.email === "string" ? s.email : "",
  }),
  component: LoginPage,
});

function LoginPage() {
  const hub = useHub();
  const nav = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState(search.email);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (hub.ready && hub.me && !search.add) {
    return <Navigate to="/hub" />;
  }

  return (
    <AuthFrame title="Sign in to campus">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await hub.signIn(email, password);
            await nav({ to: "/hub" });
          } catch (ex) {
            setErr(ex instanceof Error ? ex.message : "Could not sign in");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <Link to="/forgot-password" className="text-primary hover:underline">
          Forgot password
        </Link>
        <Link to="/signup" className="text-primary hover:underline">
          Create account
        </Link>
      </div>
    </AuthFrame>
  );
}

export function AuthFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img src="/campus/hero.jpg" alt="" className="absolute inset-0 size-full object-cover object-center" />
        <div className="absolute inset-0 bg-navy/70" />
        <div className="relative flex h-full flex-col justify-end p-10 text-navy-foreground">
          <p className="font-display text-4xl font-semibold leading-tight">Aleibiri campus, connected.</p>
          <p className="mt-3 max-w-md text-sm text-navy-foreground/80">
            Email-only accounts. Official notices. Clubs, events and messages for BYSPOLY.
          </p>
        </div>
      </div>
      <div className="flex flex-col justify-center px-6 py-12">
        <div className="mx-auto w-full max-w-md">
          <Link to="/">
            <Wordmark />
          </Link>
          <h1 className="mt-8 font-display text-3xl font-semibold">{title}</h1>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}