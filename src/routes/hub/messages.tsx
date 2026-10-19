import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { UserAvatar } from "@/components/ui/avatar";
import { useHub } from "@/lib/hub";
import { chatAlive, chatPreview, clock } from "@/lib/chat";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/hub/messages")({ component: MessagesLayout });

function MessagesLayout() {
  const hub = useHub();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const me = hub.me!;
  const convos = hub.db.conversations
    .map((c) => {
      const members = hub.db.convMembers.filter((m) => m.conversation_id === c.id);
      const otherId = members.find((m) => m.user_id !== me.id)?.user_id;
      const other = otherId ? hub.profileById(otherId) : undefined;
      const msgs = hub.db.messages.filter((m) => m.conversation_id === c.id && chatAlive(m));
      const last = msgs[msgs.length - 1];
      const unread = msgs.filter((m) => m.sender_id !== me.id && !m.read_at).length;
      return { c, other, last, unread };
    })
    .filter((x) => x.other)
    .sort((a, b) => +new Date(b.last?.created_at || 0) - +new Date(a.last?.created_at || 0));

  return (
    <div className="grid min-h-[70vh] overflow-hidden rounded-xl bg-card shadow-soft md:grid-cols-[280px_minmax(0,1fr)]">
      <aside className={cn("border-b border-border md:border-b-0 md:border-r", pathname !== "/hub/messages" && "hidden md:block")}>
        <div className="border-b border-border px-4 py-3 font-display text-lg font-semibold">Messages</div>
        <ul>
          {convos.map(({ c, other, last, unread }) => (
            <li key={c.id}>
              <Link
                to="/hub/messages/$id"
                params={{ id: c.id }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 hover:bg-muted",
                  pathname.endsWith(c.id) && "bg-muted",
                )}
              >
                <UserAvatar profile={other!} size={40} showOnline online={hub.isOnline(other!.id)} />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{other!.full_name}</span>
                    {last && <span className="text-[10px] text-muted-foreground">{clock(last.created_at)}</span>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{last ? chatPreview(last) : "No messages yet"}</p>
                </div>
                {unread > 0 && <span className="size-2 rounded-full bg-accent" />}
              </Link>
            </li>
          ))}
          {convos.length === 0 && (
            <li className="px-4 py-8 text-sm text-muted-foreground">Open a profile and tap Message to start a chat.</li>
          )}
        </ul>
      </aside>
      <div className={cn(pathname === "/hub/messages" && "hidden md:block")}>
        {pathname === "/hub/messages" ? (
          <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
            Select a conversation
          </div>
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  );
}
