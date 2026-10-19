import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { UserAvatar } from "@/components/ui/avatar";
import { useHub } from "@/lib/hub";
import { timeAgo } from "@/lib/utils";

export const Route = createFileRoute("/hub/notifications")({ component: Page });

function Page() {
  const hub = useHub();
  const mine = hub.db.notifications.filter((n) => n.user_id === hub.me?.id);
  useEffect(() => {
    void hub.markNotificationsRead();
  }, []);
  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl font-semibold">Notifications</h1>
      {mine.length === 0 && (
        <p className="rounded-xl bg-card p-8 text-center text-sm text-muted-foreground shadow-soft">
          You are up to date.
        </p>
      )}
      {mine.map((n) => {
        const actor = n.actor_id ? hub.profileById(n.actor_id) : undefined;
        const to =
          n.type === "message" && n.entity_id
            ? `/hub/messages/${n.entity_id}`
            : actor
              ? `/hub/profile/${actor.id}`
              : "/hub";
        return (
          <a
            key={n.id}
            href={to}
            className={`flex items-center gap-3 rounded-xl p-3 shadow-soft ${n.read ? "bg-card" : "bg-card ring-1 ring-primary/30"}`}
          >
            {actor && <UserAvatar profile={actor} size={36} />}
            <div className="min-w-0">
              <p className="text-sm">{n.message}</p>
              <p className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
            </div>
          </a>
        );
      })}
    </div>
  );
}