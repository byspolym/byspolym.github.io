import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { useHub } from "@/lib/hub";
import { friendshipBetween } from "@/lib/platform";
import { toast } from "sonner";

export const Route = createFileRoute("/hub/friends")({ component: FriendsPage });

function FriendsPage() {
  const hub = useHub();
  const me = hub.me!;
  const incoming = hub.db.friendships.filter((f) => f.addressee_id === me.id && f.status === "pending");
  const outgoing = hub.db.friendships.filter((f) => f.requester_id === me.id && f.status === "pending");
  const friends = hub.db.friendships.filter(
    (f) => f.status === "accepted" && (f.requester_id === me.id || f.addressee_id === me.id),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Friends</h1>
        <p className="text-sm text-muted-foreground">Stories and direct messages stay between friends.</p>
      </div>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Requests</h2>
        {incoming.length === 0 && <p className="text-sm text-muted-foreground">No pending requests.</p>}
        {incoming.map((f) => {
          const person = hub.profileById(f.requester_id);
          if (!person) return null;
          return (
            <div key={f.id} className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-soft">
              <UserAvatar profile={person} to={`/hub/profile/${person.id}`} />
              <div className="min-w-0 flex-1 font-semibold">{person.full_name}</div>
              <Button size="sm" onClick={() => hub.respondFriend(f.id, "accepted").then(() => toast.success("Accepted")).catch((e) => toast.error(e.message))}>Accept</Button>
              <Button size="sm" variant="outline" onClick={() => hub.respondFriend(f.id, "rejected")}>Decline</Button>
            </div>
          );
        })}
        {outgoing.map((f) => {
          const person = hub.profileById(f.addressee_id);
          if (!person) return null;
          return <p key={f.id} className="text-sm text-muted-foreground">Waiting on {person.full_name}</p>;
        })}
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your friends</h2>
        {friends.length === 0 && <p className="text-sm text-muted-foreground">No friends yet. Open a profile and send a request.</p>}
        {friends.map((f) => {
          const id = f.requester_id === me.id ? f.addressee_id : f.requester_id;
          const person = hub.profileById(id);
          if (!person) return null;
          return (
            <Link key={f.id} to="/hub/profile/$id" params={{ id }} className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-soft">
              <UserAvatar profile={person} />
              <span className="font-semibold">{person.full_name}</span>
            </Link>
          );
        })}
      </section>
      <p className="text-xs text-muted-foreground">
        {friendshipBetween(hub.db.friendships, me.id, me.id) ? "" : "Follow someone from their profile. Friendship is separate and required for chat."}
      </p>
    </div>
  );
}
