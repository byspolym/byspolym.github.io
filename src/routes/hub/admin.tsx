import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { RoleBadge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import { useHub } from "@/lib/hub";
import type { Article, SitePage, SiteSettings } from "@/lib/types";
import { SCHEMA_SQL } from "@/lib/schema-sql";
import { toast } from "sonner";

export const Route = createFileRoute("/hub/admin")({ component: AdminPage });

const TABS = ["stats", "people", "reports", "content", "pages", "articles", "site", "log"] as const;
type Tab = (typeof TABS)[number];

const IMAGE_FIELDS: { key: keyof SiteSettings["images"]; label: string }[] = [
  { key: "hero", label: "Hero background" },
  { key: "rector", label: "Rector" },
  { key: "registrar", label: "Registrar" },
  { key: "deputyAcademics", label: "Deputy Rector, Academics" },
  { key: "deputyAdmin", label: "Deputy Rector, Administration" },
  { key: "librarian", label: "Librarian" },
  { key: "bursar", label: "Bursar" },
  { key: "workshop", label: "Workshop" },
  { key: "library", label: "Library" },
  { key: "sports", label: "Sports" },
  { key: "auditorium", label: "Auditorium" },
];

function AdminPage() {
  const hub = useHub();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("stats");
  const [notice, setNotice] = useState("");
  const [sqlOpen, setSqlOpen] = useState(false);

  const stats = useMemo(
    () => ({
      members: hub.db.profiles.length,
      verified: hub.db.profiles.filter((p) => p.is_verified).length,
      banned: hub.db.profiles.filter((p) => p.is_banned).length,
      posts: hub.db.posts.length,
      groups: hub.db.groups.length,
      events: hub.db.events.length,
      openReports: hub.db.reports.filter((r) => r.status === "open").length,
    }),
    [hub.db],
  );

  if (!hub.ready) return <p className="text-sm text-muted-foreground">Loading administration…</p>;
  if (hub.me?.role !== "admin") {
    return <p className="text-sm text-muted-foreground">Admin access only.</p>;
  }

  const people = hub.db.profiles.filter(
    (p) =>
      p.full_name.toLowerCase().includes(q.toLowerCase()) ||
      p.email.toLowerCase().includes(q.toLowerCase()) ||
      p.username.toLowerCase().includes(q.toLowerCase()),
  );

  const act = async (work: Promise<void>, ok: string) => {
    try {
      await work;
      toast.success(ok);
    } catch (ex) {
      toast.error(ex instanceof Error ? ex.message : "Failed");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">Administration</h1>
        <p className="text-sm text-muted-foreground">Members, content, landing images, and campus pages.</p>
      </div>
      {hub.backend !== "supabase" && (
        <section className="rounded-xl border border-accent/40 bg-card p-4 shadow-soft">
          <h2 className="font-display text-lg font-semibold">Live database is not connected</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Students still see the campus preview. Only administrators see this. Run the script once in the Supabase SQL Editor, then reload.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(SCHEMA_SQL);
                toast.success("SQL copied");
              }}
            >
              Copy SQL
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSqlOpen((v) => !v)}>
              {sqlOpen ? "Hide SQL" : "View SQL"}
            </Button>
          </div>
          {sqlOpen && (
            <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed">{SCHEMA_SQL}</pre>
          )}
        </section>
      )}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
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

      {tab === "stats" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(stats).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-card p-4 shadow-soft">
                <div className="font-display text-2xl font-semibold tabular-nums">{v}</div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k}</div>
              </div>
            ))}
          </div>
          <form
            className="rounded-xl bg-card p-4 shadow-soft"
            onSubmit={(e) => {
              e.preventDefault();
              void act(hub.createPost({ content: notice, announcement: true }), "Announcement pinned").then(() =>
                setNotice(""),
              );
            }}
          >
            <h2 className="font-display text-lg font-semibold">Official announcement</h2>
            <Textarea className="mt-3" value={notice} onChange={(e) => setNotice(e.target.value)} placeholder="Campus-wide notice" required />
            <Button className="mt-3" type="submit">Publish & pin</Button>
          </form>
        </>
      )}

      {tab === "people" && (
        <div className="space-y-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members" />
          {people.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-card p-3 shadow-soft">
              <UserAvatar profile={p} />
              <div className="min-w-0 flex-1">
                <Link to="/hub/profile/$id" params={{ id: p.id }} className="font-semibold hover:underline">
                  {p.full_name}
                </Link>
                <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  {p.email} · <RoleBadge role={p.role} />
                  {(p.strikes ?? 0) > 0 && <span>{p.strikes} strike{(p.strikes ?? 0) === 1 ? "" : "s"}</span>}
                  {p.is_muted && <span>Muted</span>}
                  {p.is_banned && <span className="text-destructive">Restricted</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="outline" onClick={() => void act(hub.verifyUser(p.id, !p.is_verified), p.is_verified ? "Verification removed" : "Account verified")}>
                  {p.is_verified ? "Unverify" : "Verify"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void act(hub.strikeUser(p.id), "Strike recorded")}>
                  Strike
                </Button>
                <Button size="sm" variant="outline" onClick={() => void act(hub.muteUser(p.id, !p.is_muted), p.is_muted ? "Unmuted" : "Muted")}>
                  {p.is_muted ? "Unmute" : "Mute"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void act(hub.setRole(p.id, p.role === "admin" ? "staff" : "admin"), "Role updated")}>
                  {p.role === "admin" ? "Demote" : "Make admin"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void act(hub.forceLogout(p.id), "Session revoked")}>
                  Force logout
                </Button>
                <Button
                  size="sm"
                  variant={p.is_banned ? "outline" : "destructive"}
                  onClick={() =>
                    void act(
                      hub.banUser(p.id, !p.is_banned, p.is_banned ? "" : "Restricted by administrator"),
                      p.is_banned ? "Account restored" : "Account restricted",
                    )
                  }
                >
                  {p.is_banned ? "Restore" : "Restrict"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "reports" && (
        <div className="space-y-3">
          {hub.db.reports.length === 0 && <p className="text-sm text-muted-foreground">No reports.</p>}
          {hub.db.reports.map((r) => {
            const reporter = hub.profileById(r.reporter_id);
            return (
              <article key={r.id} className="rounded-xl bg-card p-4 shadow-soft">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {r.target_type} · {r.status}
                </div>
                <h3 className="mt-1 font-semibold">{r.reason}</h3>
                <p className="text-sm text-muted-foreground">{r.details}</p>
                <p className="mt-2 text-xs">From {reporter?.full_name} · target {r.target_id}</p>
                {r.status === "open" && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => void act(hub.resolveReport(r.id, "resolved", "Action taken"), "Report resolved")}>
                      Resolve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void act(hub.resolveReport(r.id, "dismissed", "No violation"), "Report dismissed")}>
                      Dismiss
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {tab === "content" && (
        <div className="space-y-6">
          <ContentList
            title="Posts"
            rows={hub.db.posts.slice(0, 20).map((p) => ({
              id: p.id,
              label: p.content.slice(0, 120) || "Media post",
              meta: hub.profileById(p.author_id)?.full_name,
            }))}
            onDelete={(id) => void act(hub.deletePost(id), "Post removed")}
          />
          <ContentList
            title="Comments"
            rows={hub.db.comments.slice(0, 20).map((c) => ({
              id: c.id,
              label: c.content.slice(0, 120),
              meta: hub.profileById(c.author_id)?.full_name,
            }))}
            onDelete={(id) => void act(hub.deleteComment(id), "Comment removed")}
          />
          <ContentList
            title="Stories"
            rows={(hub.db.stories ?? []).map((s) => ({
              id: s.id,
              label: "Story",
              meta: hub.profileById(s.author_id)?.full_name,
            }))}
            onDelete={(id) => void act(hub.deleteStory(id), "Story removed")}
          />
          <ContentList
            title="Messages"
            rows={hub.db.messages.slice(-20).reverse().map((m) => ({
              id: m.id,
              label: m.body.slice(0, 120),
              meta: hub.profileById(m.sender_id)?.full_name,
            }))}
            onDelete={(id) => void act(hub.deleteMessage(id), "Message removed")}
          />
          <ContentList
            title="Groups"
            rows={hub.db.groups.map((g) => {
              const owner = hub.profileById(g.created_by);
              return { id: g.id, label: g.name, meta: `${g.category}${owner ? ` · ${owner.full_name}` : ""}` };
            })}
            onDelete={(id) => void act(hub.deleteGroup(id), "Group removed")}
            extra={(id) => {
              const group = hub.db.groups.find((g) => g.id === id);
              const owner = group ? hub.profileById(group.created_by) : undefined;
              if (!group || !owner || owner.role === "admin") return null;
              return (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void act(hub.banUser(owner.id, true, "Group administrator restricted"), "Group admin restricted")}
                >
                  {owner.is_banned ? "Restricted" : "Ban admin"}
                </Button>
              );
            }}
          />
          <ContentList
            title="Events"
            rows={hub.db.events.map((e) => ({ id: e.id, label: e.title, meta: e.location }))}
            onDelete={(id) => void act(hub.deleteEvent(id), "Event removed")}
          />
        </div>
      )}

      {tab === "pages" && (
        <div className="space-y-4">
          {(hub.db.pages ?? []).map((page) => (
            <PageEditor key={page.slug} page={page} onSave={(title, body) => hub.updatePage(page.slug, { title, body })} />
          ))}
        </div>
      )}

      {tab === "articles" && <ArticlesPanel />}

      {tab === "site" && <SitePanel />}

      {tab === "log" && (
        <div className="space-y-2">
          {(hub.db.logs ?? []).length === 0 && <p className="text-sm text-muted-foreground">No administrator actions yet.</p>}
          {(hub.db.logs ?? []).slice(0, 40).map((row) => (
            <div key={row.id} className="rounded-xl bg-card px-3 py-2 text-sm shadow-soft">
              <span className="font-semibold">{row.action}</span>
              <span className="text-muted-foreground"> · {row.detail}</span>
              <div className="text-xs text-muted-foreground">
                {hub.profileById(row.actor_id)?.full_name} · {new Date(row.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContentList({
  title,
  rows,
  onDelete,
  extra,
}: {
  title: string;
  rows: { id: string; label: string; meta?: string }[];
  onDelete: (id: string) => void;
  extra?: (id: string) => ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Nothing here.</p>}
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-3 rounded-xl bg-card px-3 py-2 shadow-soft">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{row.label}</p>
            {row.meta && <p className="truncate text-xs text-muted-foreground">{row.meta}</p>}
          </div>
          <Button size="sm" variant="destructive" onClick={() => onDelete(row.id)}>
            Delete
          </Button>
          {extra?.(row.id)}
        </div>
      ))}
    </section>
  );
}

function PageEditor({ page, onSave }: { page: SitePage; onSave: (title: string, body: string) => Promise<void> }) {
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  return (
    <form
      className="space-y-2 rounded-xl bg-card p-4 shadow-soft"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await onSave(title, body);
          toast.success("Page saved");
        } catch (ex) {
          toast.error(ex instanceof Error ? ex.message : "Failed");
        }
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">/{page.slug}</p>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-36" />
      <Button type="submit" size="sm">Save page</Button>
    </form>
  );
}

function ArticlesPanel() {
  const hub = useHub();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [excerpt, setExcerpt] = useState("");
  return (
    <div className="space-y-4">
      <form
        className="space-y-2 rounded-xl bg-card p-4 shadow-soft"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await hub.saveArticle({ title, body, excerpt });
            setTitle("");
            setBody("");
            setExcerpt("");
            toast.success("Article published");
          } catch (ex) {
            toast.error(ex instanceof Error ? ex.message : "Failed");
          }
        }}
      >
        <h2 className="font-display text-lg font-semibold">New article</h2>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required />
        <Input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Short excerpt" />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Article body" required />
        <Button type="submit" size="sm">Publish</Button>
      </form>
      {(hub.db.articles ?? []).map((article) => (
        <ArticleRow key={article.id} article={article} />
      ))}
    </div>
  );
}

function ArticleRow({ article }: { article: Article }) {
  const hub = useHub();
  return (
    <div className="flex items-center gap-3 rounded-xl bg-card px-3 py-2 shadow-soft">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{article.title}</p>
        <p className="truncate text-xs text-muted-foreground">{article.published ? "Published" : "Hidden"} · /articles/{article.slug}</p>
      </div>
      <Button size="sm" variant="outline" onClick={() => void hub.saveArticle({ ...article, published: !article.published }).then(() => toast.success("Updated"))}>
        {article.published ? "Unpublish" : "Publish"}
      </Button>
      <Button size="sm" variant="destructive" onClick={() => void hub.deleteArticle(article.id).then(() => toast.success("Article deleted"))}>
        Delete
      </Button>
    </div>
  );
}

function SitePanel() {
  const hub = useHub();
  const settings = hub.db.settings;
  const [message, setMessage] = useState(settings.maintenance_message);
  const [images, setImages] = useState(settings.images);
  return (
    <form
      className="space-y-3 rounded-xl bg-card p-4 shadow-soft"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await hub.updateSettings({ maintenance_message: message, images });
          toast.success("Site settings saved");
        } catch (ex) {
          toast.error(ex instanceof Error ? ex.message : "Failed");
        }
      }}
    >
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={settings.maintenance}
          onChange={(e) => void hub.updateSettings({ maintenance: e.target.checked }).then(() => toast.success(e.target.checked ? "Maintenance on" : "Maintenance off"))}
        />
        Maintenance mode
      </label>
      <Textarea value={message} onChange={(e) => setMessage(e.target.value)} />
      {IMAGE_FIELDS.map((field) => (
        <div key={field.key}>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{field.label}</p>
          <Input
            value={images[field.key]}
            onChange={(e) => setImages({ ...images, [field.key]: e.target.value })}
          />
        </div>
      ))}
      <Button type="submit">Save landing & message</Button>
    </form>
  );
}
