import { Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Search,
  Shield,
  Sun,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Wordmark } from "@/components/brand/logo";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useHub } from "@/lib/hub";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/hub", label: "Feed", icon: Home },
  { to: "/hub/friends", label: "Friends", icon: UserPlus },
  { to: "/hub/groups", label: "Clubs", icon: Users },
  { to: "/hub/events", label: "Events", icon: CalendarDays },
  { to: "/hub/messages", label: "Messages", icon: MessageCircle },
  { to: "/hub/search", label: "Search", icon: Search },
  { to: "/hub/notifications", label: "Alerts", icon: Bell },
];

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("byspoly-theme");
    const prefer = stored ? stored === "dark" : false;
    setDark(prefer);
    document.documentElement.classList.toggle("dark", prefer);
  }, []);
  const toggle = () => {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("byspoly-theme", next ? "dark" : "light");
      return next;
    });
  };
  return { dark, toggle };
}

export function HubShell() {
  const hub = useHub();
  const { dark, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [more, setMore] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const nav = useNavigate();
  const unread = useMemo(
    () => hub.db.notifications.filter((n) => n.user_id === hub.me?.id && !n.read).length,
    [hub.db.notifications, hub.me?.id],
  );
  const unreadMsg = useMemo(() => {
    if (!hub.me) return 0;
    const mine = new Set(
      hub.db.convMembers.filter((m) => m.user_id === hub.me!.id).map((m) => m.conversation_id),
    );
    return hub.db.messages.filter((m) => mine.has(m.conversation_id) && m.sender_id !== hub.me!.id && !m.read_at)
      .length;
  }, [hub.db.messages, hub.db.convMembers, hub.me]);

  if (!hub.ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="text-center">
          <img src="/crest.png" alt="" className="mx-auto size-14 rounded-full" />
          <p className="mt-3 font-display text-lg">Opening campus hub…</p>
        </div>
      </div>
    );
  }

  if (!hub.me) {
    return <Navigate to="/login" />;
  }

  if (hub.db.settings?.maintenance && hub.me.role !== "admin") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 text-center">
        <img src="/crest-official.jpg" alt="" className="mx-auto size-16 rounded-full bg-white object-contain" />
        <h1 className="mt-4 font-display text-2xl">Maintenance</h1>
        <p className="mt-2 text-sm text-muted-foreground">{hub.db.settings.maintenance_message}</p>
      </main>
    );
  }

  if (hub.me.is_banned) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 text-center">
        <img src="/crest.png" alt="" className="mx-auto size-16 rounded-full" />
        <h1 className="mt-4 font-display text-2xl">Account restricted</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {hub.me.ban_reason || "This account cannot post, comment or message. Contact ICT if this is a mistake."}
        </p>
        <Button className="mt-6" variant="outline" onClick={() => hub.signOut()}>
          Sign out
        </Button>
      </main>
    );
  }

  const items = [
    ...NAV,
    ...(hub.me.role === "admin" ? [{ to: "/hub/admin", label: "Admin", icon: Shield }] : []),
  ];

  return (
    <div className="min-h-dvh bg-background">
      <div className="flex h-1 w-full">
        <span className="flex-1 bg-navy" />
        <span className="flex-1 bg-forest" />
        <span className="flex-1 bg-accent" />
      </div>
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/hub" className="min-w-0">
            <Wordmark compact />
          </Link>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Toggle theme">
              {dark ? <Sun /> : <Moon />}
            </Button>
            <div className="relative">
              <button type="button" className="ml-1 rounded-full" onClick={() => setAccountsOpen((v) => !v)} aria-label="Accounts">
                <UserAvatar profile={hub.me} size={32} />
              </button>
              {accountsOpen && (
                <div className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-xl border border-border bg-card shadow-soft">
                  <Link to="/hub/profile/$id" params={{ id: hub.me.id }} className="block px-3 py-2 text-sm font-semibold hover:bg-muted" onClick={() => setAccountsOpen(false)}>
                    View profile
                  </Link>
                  <div className="border-t border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Accounts on this device
                  </div>
                  {hub.deviceAccounts.map((a) => (
                    <button
                      key={a.userId}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        const result = hub.switchAccount(a.userId);
                        setAccountsOpen(false);
                        if (result?.needsLogin) void nav({ to: "/login", search: { add: true, email: result.email } });
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">{a.full_name}</span>
                      <span className="text-[10px] uppercase text-muted-foreground">
                        {a.userId === hub.me.id ? "Current" : a.active ? "Switch" : "Sign in"}
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="w-full border-t border-border px-3 py-2 text-left text-sm font-semibold text-primary hover:bg-muted"
                    onClick={() => {
                      setAccountsOpen(false);
                      void nav({ to: "/login", search: { add: true, email: "" } });
                    }}
                  >
                    Add account
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-5 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_280px]">
        <aside className="hidden lg:block">
          <nav className="sticky top-20 space-y-1">
            {items.map((item) => {
              const active = item.to === "/hub" ? pathname === "/hub" : pathname.startsWith(item.to);
              const Icon = item.icon;
              const badge =
                item.to === "/hub/notifications" ? unread : item.to === "/hub/messages" ? unreadMsg : 0;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium",
                    active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="flex-1">{item.label}</span>
                  {badge > 0 && (
                    <span className="rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
            <Link
              to="/hub/settings"
              className="flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-muted"
            >
              <UserRound className="size-4" /> Settings
            </Link>
            <button
              type="button"
              className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
              onClick={() => hub.signOut()}
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </nav>
        </aside>
        <main className="min-w-0 pb-20 lg:pb-8">
          <Outlet />
        </main>
        <aside className="hidden xl:block">
          <RightRail />
        </aside>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] lg:hidden">
        {[
          { to: "/hub", icon: Home, label: "Feed" },
          { to: "/hub/groups", icon: Users, label: "Clubs" },
          { to: "/hub/events", icon: CalendarDays, label: "Events" },
          { to: "/hub/messages", icon: MessageCircle, label: "Chat", badge: unreadMsg },
        ].map((item) => {
          const Icon = item.icon;
          const active = item.to === "/hub" ? pathname === "/hub" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {item.label}
              {!!item.badge && item.badge > 0 && (
                <span className="absolute right-[calc(50%-18px)] top-1 size-2 rounded-full bg-accent" />
              )}
            </Link>
          );
        })}
        <button
          type="button"
          className={cn(
            "relative flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold",
            more ? "text-primary" : "text-muted-foreground",
          )}
          onClick={() => setMore((v) => !v)}
        >
          {more ? <X className="size-5" /> : <Menu className="size-5" />}
          More
          {unread > 0 && !more && (
            <span className="absolute right-[calc(50%-18px)] top-1 size-2 rounded-full bg-accent" />
          )}
        </button>
      </nav>
      {more && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            aria-label="Close menu"
            onClick={() => setMore(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-card pb-[calc(env(safe-area-inset-bottom)+4.5rem)] pt-3 shadow-soft">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <div className="grid grid-cols-3 gap-1 px-3">
              {[
                { to: "/hub/friends", icon: UserPlus, label: "Friends" },
                { to: "/hub/search", icon: Search, label: "Search" },
                { to: "/hub/notifications", icon: Bell, label: "Alerts", badge: unread },
                { to: "/hub/settings", icon: UserRound, label: "Settings" },
                ...(hub.me.role === "admin"
                  ? [{ to: "/hub/admin", icon: Shield, label: "Admin" }]
                  : []),
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMore(false)}
                    className="relative flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-xs font-semibold hover:bg-muted"
                  >
                    <Icon className="size-5" />
                    {item.label}
                    {"badge" in item && item.badge ? (
                      <span className="absolute right-4 top-2 size-2 rounded-full bg-accent" />
                    ) : null}
                  </Link>
                );
              })}
              <button
                type="button"
                className="flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-xs font-semibold text-muted-foreground hover:bg-muted"
                onClick={() => hub.signOut()}
              >
                <LogOut className="size-5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RightRail() {
  const hub = useHub();
  const upcoming = [...hub.db.events]
    .filter((e) => new Date(e.starts_at).getTime() >= Date.now() - 3600_000)
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))
    .slice(0, 4);
  const people = hub.db.profiles.filter((p) => p.id !== hub.me?.id && !p.is_banned).slice(0, 5);
  return (
    <div className="sticky top-20 space-y-4">
      <section className="rounded-xl bg-card p-4 shadow-soft">
        <h2 className="font-display text-base font-semibold">Upcoming</h2>
        <ul className="mt-3 space-y-3">
          {upcoming.map((e) => (
            <li key={e.id}>
              <Link to="/hub/events" className="block">
                <div className="text-sm font-semibold leading-snug">{e.title}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(e.starts_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })} · {e.location}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-xl bg-card p-4 shadow-soft">
        <h2 className="font-display text-base font-semibold">On campus</h2>
        <ul className="mt-3 space-y-2">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <UserAvatar profile={p} size={32} showOnline online={hub.isOnline(p.id)} to={`/hub/profile/${p.id}`} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{p.full_name}</div>
                <div className="truncate text-xs text-muted-foreground">{p.department || p.role}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}