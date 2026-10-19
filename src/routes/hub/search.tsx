import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PostCard } from "@/components/feed/post-card";
import { UserAvatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useHub } from "@/lib/hub";

export const Route = createFileRoute("/hub/search")({
  validateSearch: (s: Record<string, unknown>): { q: string } => ({
    q: typeof s.q === "string" ? s.q : "",
  }),
  component: SearchPage,
});

function SearchPage() {
  const hub = useHub();
  const initial = Route.useSearch();
  const [q, setQ] = useState(initial.q);
  useEffect(() => setQ(initial.q), [initial.q]);
  const [tab, setTab] = useState<"people" | "posts" | "groups">("people");
  const result = useMemo(() => hub.search(q), [q, hub.db, hub.me?.id]);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">Search campus</h1>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="People, posts, clubs…"
        autoFocus
      />
      <div className="flex gap-2">
        {(["people", "posts", "groups"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`h-9 rounded-full px-3 text-sm font-semibold capitalize ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            {t}
          </button>
        ))}
      </div>
      {q.trim() === "" && <p className="text-sm text-muted-foreground">Try a name, department, or a word from a post.</p>}
      {tab === "people" && (
        <ul className="space-y-2">
          {result.people.map((p) => (
            <li key={p.id}>
              <Link to="/hub/profile/$id" params={{ id: p.id }} className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-soft">
                <UserAvatar profile={p} />
                <div>
                  <div className="font-semibold">{p.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.department} · {p.level}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {tab === "posts" && result.posts.map((p) => <PostCard key={p.id} post={p} />)}
      {tab === "groups" && (
        <ul className="space-y-2">
          {result.groups.map((g) => (
            <li key={g.id}>
              <Link to="/hub/groups/$id" params={{ id: g.id }} className="block rounded-xl bg-card p-4 shadow-soft">
                <div className="font-semibold">{g.name}</div>
                <p className="text-sm text-muted-foreground">{g.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
