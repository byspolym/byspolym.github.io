import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bookmark,
  Flag,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { OfficialBadge, RoleBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/input";
import { REACTIONS } from "@/lib/platform";
import { useHub } from "@/lib/hub";
import type { FeedPost } from "@/lib/types";
import { REPORT_REASONS } from "@/lib/constants";
import { cn, timeAgo } from "@/lib/utils";
import { toast } from "sonner";

function RichText({ text }: { text: string }) {
  const parts = text.split(/([#@][\w.]+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("#") || part.startsWith("@")) {
          const q = part.slice(1);
          return (
            <Link key={i} to="/hub/search" search={{ q }} className="font-semibold text-primary hover:underline">
              {part}
            </Link>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function PostCard({ post }: { post: FeedPost }) {
  const hub = useHub();
  const [openComments, setOpenComments] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]!);
  const [details, setDetails] = useState("");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [reactOpen, setReactOpen] = useState(false);
  const comments = openComments ? hub.commentsFor(post.id) : [];
  const canDelete = hub.me?.id === post.author_id || hub.me?.role === "admin";

  useEffect(() => {
    if (!hub.me || hub.me.id === post.author_id) return;
    const key = `byspoly-view-${post.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void hub.recordPostStat(post.id, "view");
  }, [post.id, post.author_id, hub.me?.id]);

  return (
    <article
      className={cn(
        "rounded-xl bg-card p-4 shadow-soft sm:p-5",
        post.is_announcement && "ring-1 ring-accent/40",
      )}
    >
      <header className="flex items-start gap-3">
        <UserAvatar
          profile={post.author}
          to={`/hub/profile/${post.author.id}`}
          showOnline
          online={hub.isOnline(post.author.id)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              to="/hub/profile/$id"
              params={{ id: post.author.id }}
              className="truncate font-semibold text-foreground hover:underline"
            >
              {post.author.full_name}
            </Link>
            <RoleBadge role={post.author.role} />
            {post.is_announcement && <OfficialBadge />}
          </div>
          <div className="text-xs text-muted-foreground">
            @{post.author.username} · {timeAgo(post.created_at)}
            {post.author.department ? ` · ${post.author.department}` : ""}
          </div>
        </div>
        <div className="relative">
          <button
            type="button"
            className="rounded-sm p-2 text-muted-foreground hover:bg-muted"
            onClick={() => setMenu((v) => !v)}
            aria-label="Post actions"
          >
            <MoreHorizontal className="size-4" />
          </button>
          {menu && (
            <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-md border border-border bg-popover py-1 text-sm shadow-soft">
              {canDelete && (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-destructive hover:bg-muted"
                  onClick={async () => {
                    setMenu(false);
                    try {
                      await hub.deletePost(post.id);
                      toast.success("Post removed");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not delete");
                    }
                  }}
                >
                  <Trash2 className="size-4" /> Delete
                </button>
              )}
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted"
                onClick={() => {
                  setMenu(false);
                  setReportOpen(true);
                }}
              >
                <Flag className="size-4" /> Report
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted"
                onClick={async () => {
                  setMenu(false);
                  try {
                    await hub.toggleSave(post.id);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not save");
                  }
                }}
              >
                <Bookmark className="size-4" /> {post.saved_by_me ? "Unsave" : "Save"}
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted"
                onClick={async () => {
                  setMenu(false);
                  const shareText = `${post.author.full_name} on Byspolyhub: ${post.content}`;
                  try {
                    if (navigator.share) await navigator.share({ title: "Byspolyhub", text: shareText });
                    else {
                      await navigator.clipboard.writeText(shareText);
                      toast.success("Post copied");
                    }
                    await hub.recordPostStat(post.id, "share");
                  } catch {
                    /* dismissed */
                  }
                }}
              >
                <Share2 className="size-4" /> Share
              </button>
            </div>
          )}
        </div>
      </header>
      <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
        <RichText text={post.content} />
      </p>
      <PostMedia post={post} onOpen={setLightbox} />
      <div className="mt-3 flex items-center gap-1 border-t border-border pt-2">
        <div className="relative">
          <button
            type="button"
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium",
              post.liked_by_me || post.my_reaction ? "text-accent" : "text-muted-foreground hover:bg-muted",
            )}
            onClick={() => setReactOpen((v) => !v)}
          >
            <Heart className={cn("size-4", (post.liked_by_me || post.my_reaction) && "fill-current")} />
            {post.my_reaction || post.like_count}
          </button>
          {reactOpen && (
            <div className="absolute bottom-11 left-0 z-20 flex gap-1 rounded-full border border-border bg-card px-2 py-1 shadow-soft">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="px-1 text-lg"
                  onClick={() => {
                    setReactOpen(false);
                    void hub.toggleReaction(post.id, emoji);
                    if (!post.liked_by_me) void hub.toggleLike(post.id);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
          onClick={() => setOpenComments((v) => !v)}
        >
          <MessageCircle className="size-4" />
          {post.comment_count}
        </button>
        <button
          type="button"
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium",
            post.saved_by_me ? "text-primary" : "text-muted-foreground hover:bg-muted",
          )}
          onClick={() => hub.toggleSave(post.id).catch((e) => toast.error(String(e.message || e)))}
        >
          <Bookmark className={cn("size-4", post.saved_by_me && "fill-current")} />
        </button>
      </div>
      {openComments && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {comments
            .filter((c) => !c.parent_id)
            .map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                replies={comments.filter((r) => r.parent_id === c.id)}
                onReply={() => {
                  setReplyTo(c.id);
                  setDraft(`@${c.author.username} `);
                }}
              />
            ))}
          {replyTo && <p className="text-xs text-muted-foreground">Replying to a comment. <button type="button" className="underline" onClick={() => setReplyTo(null)}>Cancel</button></p>}
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await hub.addComment(post.id, draft, replyTo);
                setDraft("");
                setReplyTo(null);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not comment");
              }
            }}
          >
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a comment"
              className="min-h-11 py-2.5"
              rows={1}
            />
            <Button type="submit" size="sm" className="h-11">
              Reply
            </Button>
          </form>
        </div>
      )}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-xl bg-card p-5 shadow-soft">
            <h3 className="font-display text-lg font-semibold">Report this post</h3>
            <p className="mt-1 text-sm text-muted-foreground">Reports go to hub administrators only.</p>
            <select
              className="mt-4 h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {REPORT_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <Textarea
              className="mt-3"
              placeholder="Optional details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setReportOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="accent"
                type="button"
                onClick={async () => {
                  try {
                    await hub.report("post", post.id, reason, details);
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
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4" onClick={() => setLightbox(null)}>
          <button type="button" className="absolute right-4 top-4 text-paper" aria-label="Close"><X /></button>
          <img src={lightbox} alt="" className="max-h-[90vh] max-w-full object-contain" />
        </div>
      )}
    </article>
  );
}

function PostMedia({ post, onOpen }: { post: FeedPost; onOpen: (url: string) => void }) {
  const media = post.media?.length
    ? post.media
    : post.image_url
      ? [{ kind: "image" as const, url: post.image_url }]
      : [];
  if (!media.length) return null;
  return (
    <div className={cn("mt-3 grid gap-2", media.length > 1 && "grid-cols-2")}>
      {media.map((item) =>
        item.kind === "video" ? (
          <video key={item.url} src={item.url} controls className="max-h-[420px] w-full rounded-lg bg-ink" />
        ) : item.kind === "audio" ? (
          <audio key={item.url} src={item.url} controls className="w-full" />
        ) : (
          <button key={item.url} type="button" className="block w-full" onClick={() => onOpen(item.url)}>
            <img src={item.url} alt="" className="max-h-[420px] w-full rounded-lg object-cover" />
          </button>
        ),
      )}
    </div>
  );
}

function CommentRow({
  comment,
  replies,
  onReply,
}: {
  comment: ReturnType<ReturnType<typeof useHub>["commentsFor"]>[number];
  replies: ReturnType<ReturnType<typeof useHub>["commentsFor"]>;
  onReply: () => void;
}) {
  const hub = useHub();
  const likes = hub.db.commentLikes.filter((l) => l.comment_id === comment.id).length;
  const mine = hub.db.commentLikes.some((l) => l.comment_id === comment.id && l.user_id === hub.me?.id);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <UserAvatar profile={comment.author} size={28} to={`/hub/profile/${comment.author.id}`} />
        <div className="min-w-0 flex-1 rounded-lg bg-muted/60 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">{comment.author.full_name}</span>
            {(hub.me?.id === comment.author_id || hub.me?.role === "admin") && (
              <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => hub.deleteComment(comment.id)} aria-label="Delete comment">
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
          <p className="text-sm leading-snug"><RichText text={comment.content} /></p>
          <div className="mt-1 flex gap-3 text-xs font-semibold text-muted-foreground">
            <button type="button" className={mine ? "text-accent" : ""} onClick={() => hub.toggleCommentLike(comment.id)}>{mine ? "Liked" : "Like"}{likes ? ` · ${likes}` : ""}</button>
            <button type="button" onClick={onReply}>Reply</button>
          </div>
        </div>
      </div>
      {replies.map((r) => (
        <div key={r.id} className="ml-8 flex gap-2">
          <UserAvatar profile={r.author} size={24} to={`/hub/profile/${r.author.id}`} />
          <div className="min-w-0 flex-1 rounded-lg bg-muted/40 px-3 py-2">
            <div className="text-sm font-semibold">{r.author.full_name}</div>
            <p className="text-sm"><RichText text={r.content} /></p>
          </div>
        </div>
      ))}
    </div>
  );
}
