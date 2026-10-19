import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { SCHEMA_SQL } from "@/lib/schema-sql";
import { useHub } from "@/lib/hub";

export const Route = createFileRoute("/setup")({ component: SetupPage });

function SetupPage() {
  const hub = useHub();
  const [copied, setCopied] = useState(false);
  if (!hub.ready) return null;
  if (!hub.me || hub.me.role !== "admin") return <Navigate to="/" />;
  return (
    <div className="min-h-dvh bg-background">
      <div className="flex h-1 w-full">
        <span className="flex-1 bg-navy" />
        <span className="flex-1 bg-forest" />
        <span className="flex-1 bg-accent" />
      </div>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/">
          <Wordmark />
        </Link>
        <h1 className="mt-8 font-display text-3xl font-semibold">Connect the live campus database</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Status now:{" "}
          <strong className="text-foreground">
            {hub.backend === "supabase" ? "live Supabase" : "campus preview"}
          </strong>
          . The hub is fully usable. Running the script once stores real student accounts in your Supabase project.
        </p>
        <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          <li>Open the Supabase SQL Editor for this project.</li>
          <li>Copy the script, paste it, and run it. It creates tables, Row Level Security, storage buckets and realtime.</li>
          <li>In Authentication → Providers, keep Email enabled and require email confirmation for new members.</li>
          <li>Administrator accounts are not self-assigned. Sign in with credentials already issued to campus administration.</li>
          <li>Reload this site after the script succeeds to switch from preview data to live data.</li>
        </ol>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              await navigator.clipboard.writeText(SCHEMA_SQL);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy SQL script"}
          </Button>
          <Link to="/login">
            <Button variant="outline">Sign in</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}