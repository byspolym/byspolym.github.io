import { createFileRoute } from '@tanstack/react-router'
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Textarea } from "@/components/ui/input";
import { DEPARTMENTS, LEVELS } from "@/lib/constants";
import { useHub } from "@/lib/hub";
import { compressImage } from "@/lib/image";
import { toast } from "sonner";

export const Route = createFileRoute("/hub/settings")({ component: SettingsPage });

function SettingsPage() {
  const hub = useHub();
  const me = hub.me!;
  const [form, setForm] = useState({
    full_name: me.full_name,
    username: me.username,
    bio: me.bio,
    department: me.department || DEPARTMENTS[0],
    level: me.level || "ND I",
    student_id: me.student_id || "",
  });
  const [password, setPassword] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your public campus profile. Photo changes left this month: {hub.usageLeft("avatar")}. Username edits: {hub.usageLeft("username")}. Name changes: {hub.usageLeft("full_name")}. Bio edits: {hub.usageLeft("bio")}.
        </p>
      </div>
      <form
        className="space-y-3 rounded-xl bg-card p-5 shadow-soft"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await hub.updateMe(form);
            toast.success("Profile saved");
          } catch (ex) {
            toast.error(ex instanceof Error ? ex.message : "Could not save");
          }
        }}
      >
        <div>
          <FieldLabel>Passport photograph</FieldLabel>
          <Input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const blob = await compressImage(f, 640, 0.78);
                await hub.setAvatar(blob);
                toast.success("Photo updated");
              } catch (ex) {
                toast.error(ex instanceof Error ? ex.message : "Upload failed");
              }
            }}
          />
        </div>
        <div>
          <FieldLabel>Full name</FieldLabel>
          <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div>
          <FieldLabel>Username</FieldLabel>
          <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </div>
        <div>
          <FieldLabel>Bio</FieldLabel>
          <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Department</FieldLabel>
            <select
              className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
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
              onChange={(e) => setForm({ ...form, level: e.target.value })}
            >
              {LEVELS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <FieldLabel>Student / staff ID</FieldLabel>
          <Input value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} />
        </div>
        <Button type="submit">Save profile</Button>
      </form>
      <form
        className="space-y-3 rounded-xl bg-card p-5 shadow-soft"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await hub.updatePassword(password);
            setPassword("");
            toast.success("Password updated");
          } catch (ex) {
            toast.error(ex instanceof Error ? ex.message : "Could not update password");
          }
        }}
      >
        <h2 className="font-display text-lg font-semibold">Password</h2>
        <Input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" variant="outline">Update password</Button>
      </form>
      {me.role === "admin" && hub.backend !== "supabase" && (
        <p className="text-sm text-muted-foreground">
          The live database is not connected. Open Administration to copy the SQL script.
        </p>
      )}
    </div>
  );
}
