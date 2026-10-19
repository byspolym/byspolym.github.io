import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Flag, MessageCircle } from "lucide-react";
import { useState } from "react";
import { PostCard } from "@/components/feed/post-card";
import { RoleBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/input";
import { REPORT_REASONS } from "@/lib/constants";
import { useHub } from "@/lib/hub";
import { friendshipBetween } from "@/lib/platform";
import { toast } from "sonner";

export const Route = createFileRoute("/hub/profile/$id")({ component: ProfilePage });

function ProfilePage() {
  const { id } = Route.useParams();
  const hub = useHub();
  const nav = useNavigate();
  const profile = hub.profileById(id);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]!);
  const [details, setDetails] = useState("");
  if (!profile) {
    return <p className="text-sm text-muted-foreground">This profile could not be found.</p>;
  }
  const posts = hub.db.posts
    .filter((p) => p.author_id === id && !p.group_id)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const feed = hub.feed().filter((p) => p.author_id === id);
  const shown = feed.length ? feed : posts.map((p) => ({
    ...p,
    author: profile,
    like_count: hub.db.likes.filter((l) => l.post_id === p.id).length,
    comment_count: hub.db.comments.filter((c) => c.post_id === p.id).length,
    liked_by_me: hub.db.likes.some((l) => l.post_id === p.id && l.user_id === hub.me?.id),
  }));
  const isMe = hub.me?.id === id;
  const friend = hub.me ? friendshipBetween(hub.db.friendships, hub.me.id, id) : undefined;
  const following = hub.me ? hub.db.follows.some((f) => f.follower_id === hub.me.id && f.following_id === id) : false;
  const followers = hub.db.follows.filter((f) => f.following_id === id).length;
  const followingCount = hub.db.follows.filter((f) => f.follower_id === id).length;
  const savedIds = new Set((hub.db.saves ?? []).filter((s) => s.user_id === hub.me?.id).map((s) => s.post_id));
  const saved = isMe
    ? hub.db.posts
        .filter((p) => savedIds.has(p.id))
        .map((p) => {
          const author = hub.profileById(p.author_id);
          if (!author) return null;
          return {
            ...p,
            author,
            like_count: hub.db.likes.filter((l) => l.post_id === p.id).length,
            comment_count: hub.db.comments.filter((c) => c.post_id === p.id).length,
            liked_by_me: hub.db.likes.some((l) => l.post_id === p.id && l.user_id === hub.me?.id),
            saved_by_me: true,
          };
        })
        .filter((p): p is NonNullable<typeof p> => !!p)
    : [];

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl bg-card shadow-soft">
        <div className="h-36 bg-navy">
          {profile.cover_url && <img src={profile.cover_url} alt="" className="size-full object-cover opacity-80" />}
        </div>
        <div className="px-5 pb-5">
          <div className="-mt-8 flex flex-wrap items-end justify-between gap-3">
            <UserAvatar profile={profile} size={72} showOnline online={hub.isOnline(profile.id)} />
            <div className="flex flex-wrap gap-2">
              {!isMe && (
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      const cid = await hub.openConversation(profile.id);
                      await nav({ to: "/hub/messages/$id", params: { id: cid } });
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not open messages");
                    }
                  }}
                >
                  <MessageCircle /> Message
                </Button>
              )}
              {!isMe && (
                <Button size="sm" variant="outline" onClick={() => hub.follow(id).catch((e) => toast.error(e instanceof Error ? e.message : "Could not follow"))}>
                  {following ? "Unfollow" : "Follow"}
                </Button>
              )}
              {!isMe && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    hub
                      .requestFriend(id)
                      .then(() => toast.success(friend?.status === "pending" && friend.addressee_id === hub.me?.id ? "You are now friends" : "Friend request sent"))
                      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not send request"))
                  }
                >
                  {friend?.status === "accepted" ? "Friends" : friend?.status === "pending" ? "Requested" : "Add friend"}
                </Button>
              )}
              {!isMe && (
                <Button size="sm" variant="outline" onClick={() => setReportOpen(true)}>
                  <Flag /> Report
                </Button>
              )}
              {isMe && (
                <Button size="sm" variant="outline" onClick={() => nav({ to: "/hub/settings" })}>
                  Edit profile
                </Button>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold">{profile.full_name}</h1>
            <RoleBadge role={profile.role} />
            {profile.is_verified && <span className="text-xs font-semibold text-primary">Verified</span>}
            {!!profile.strikes && <span className="text-xs font-semibold text-accent">{profile.strikes} strike{profile.strikes === 1 ? "" : "s"}</span>}
            {profile.is_muted && <span className="text-xs font-semibold text-destructive">Muted</span>}
          </div>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          <p className="mt-2 text-sm">
            <span className="font-semibold">{followers}</span> followers · <span className="font-semibold">{followingCount}</span> following
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {profile.department && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Department</dt>
                <dd>{profile.department}</dd>
              </div>
            )}
            {profile.level && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Level</dt>
                <dd>{profile.level}</dd>
              </div>
            )}
            {profile.student_id && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">ID</dt>
                <dd className="font-mono text-xs">{profile.student_id}</dd>
              </div>
            )}
          </dl>
          {profile.bio && <p className="mt-3 text-sm leading-relaxed">{profile.bio}</p>}
          {isMe && (
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {[
                ["Likes", hub.db.likes.filter((l) => posts.some((p) => p.id === l.post_id)).length],
                ["Comments", hub.db.comments.filter((c) => posts.some((p) => p.id === c.post_id)).length],
                ["Shares", posts.reduce((n, p) => n + (p.share_count ?? 0), 0)],
                ["Views", posts.reduce((n, p) => n + (p.view_count ?? 0), 0)],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg bg-muted px-3 py-2">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                  <dd className="font-display text-lg font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
      {isMe && saved.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Saved</h2>
          {saved.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </section>
      )}
      <h2 className="font-display text-lg font-semibold">Posts</h2>
      {shown.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-xl bg-card p-5 shadow-soft">
            <h3 className="font-display text-lg font-semibold">Report this member</h3>
            <select className="mt-4 h-11 w-full rounded-md border border-input bg-card px-3 text-sm" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REPORT_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <Textarea className="mt-3" placeholder="Optional details" value={details} onChange={(e) => setDetails(e.target.value)} />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setReportOpen(false)}>Cancel</Button>
              <Button
                variant="accent"
                type="button"
                onClick={async () => {
                  try {
                    await hub.report("user", id, reason, details);
                    setReportOpen(false);
                    toast.success("Report sent");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not report");
                  }
                }}
              >
                Submit report
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
