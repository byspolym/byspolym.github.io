import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Textarea } from "@/components/ui/input";
import { GROUP_CATEGORIES } from "@/lib/constants";
import { useHub } from "@/lib/hub";
import { compressImage } from "@/lib/image";
import { toast } from "sonner";

export const Route = createFileRoute("/hub/groups")({ component: GroupsRoute });

function GroupsRoute() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/hub/groups") return <Outlet />;
  return <GroupsPage />;
}

function GroupsPage() {
  const hub = useHub();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(GROUP_CATEGORIES[0]!);
  const [cover, setCover] = useState<File | null>(null);
  const [avatar, setAvatar] = useState<File | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Clubs & groups</h1>
          <p className="text-sm text-muted-foreground">Join a society or start one for your department.</p>
        </div>
        <Button onClick={() => setOpen(true)}>New group</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {hub.db.groups.map((g) => {
          const count = hub.db.groupMembers.filter((m) => m.group_id === g.id).length;
          const joined = hub.db.groupMembers.some((m) => m.group_id === g.id && m.user_id === hub.me?.id);
          return (
            <article key={g.id} className="overflow-hidden rounded-xl bg-card shadow-soft">
              <div className="relative h-28 bg-muted">
                {g.cover_url && <img src={g.cover_url} alt="" className="size-full object-cover" />}
                <span className="absolute bottom-2 left-3 flex size-12 items-center justify-center overflow-hidden rounded-full border-2 border-card bg-card">
                  {g.avatar_url ? <img src={g.avatar_url} alt="" className="size-full object-cover" /> : <span className="text-sm font-semibold">{g.name.slice(0, 1)}</span>}
                </span>
              </div>
              <div className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{g.category}</p>
                <h2 className="font-display text-lg font-semibold">
                  <Link to="/hub/groups/$id" params={{ id: g.id }} className="hover:underline">
                    {g.name}
                  </Link>
                </h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{g.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{count} members</span>
                  {joined ? (
                    <Link to="/hub/groups/$id" params={{ id: g.id }}>
                      <Button size="sm" variant="outline">Open</Button>
                    </Link>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() =>
                        void hub
                          .joinGroup(g.id)
                          .then(() => toast.success("You joined"))
                          .catch((ex) => toast.error(ex instanceof Error ? ex.message : "Could not join"))
                      }
                    >
                      Join
                    </Button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <form
            className="w-full max-w-md space-y-3 rounded-xl bg-card p-5 shadow-soft"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const coverBlob = cover ? await compressImage(cover, 1280, 0.62) : null;
                const avatarBlob = avatar ? await compressImage(avatar, 512, 0.7) : null;
                const g = await hub.createGroup({ name, description, category, cover: coverBlob, avatar: avatarBlob });
                setOpen(false);
                toast.success("Group created");
                await nav({ to: "/hub/groups/$id", params: { id: g.id } });
              } catch (ex) {
                toast.error(ex instanceof Error ? ex.message : "Could not create");
              }
            }}
          >
            <h3 className="font-display text-lg font-semibold">Create a group</h3>
            <div>
              <FieldLabel>Name</FieldLabel>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Category</FieldLabel>
              <select className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                {GROUP_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>About</FieldLabel>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Profile photo</FieldLabel>
              <Input type="file" accept="image/*" onChange={(e) => setAvatar(e.target.files?.[0] || null)} />
            </div>
            <div>
              <FieldLabel>Cover image</FieldLabel>
              <Input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] || null)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
