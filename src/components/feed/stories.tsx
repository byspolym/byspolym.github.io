import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Trash2, X } from "lucide-react";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useHub } from "@/lib/hub";
import { compressImage } from "@/lib/image";
import type { Story, StoryKind } from "@/lib/types";
import { toast } from "sonner";

type Draft = { kind: StoryKind; blob: Blob | null; preview: string; caption: string };

function videoLength(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that video."));
    };
    video.src = url;
  });
}

export function StoriesBar() {
  const hub = useHub();
  const nav = useNavigate();
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [compose, setCompose] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [openAuthor, setOpenAuthor] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const stories = hub.visibleStories();

  const rings = useMemo(() => {
    const map = new Map<string, Story[]>();
    const ordered = [...stories].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    for (const story of ordered) {
      const list = map.get(story.author_id) ?? [];
      list.push(story);
      map.set(story.author_id, list);
    }
    return [...map.entries()];
  }, [stories]);

  const sequence = rings.find(([id]) => id === openAuthor)?.[1] ?? [];
  const active = sequence[index];
  const author = active ? hub.profileById(active.author_id) : undefined;
  const mine = !!active && active.author_id === hub.me?.id;
  const viewers = active
    ? (hub.db.storyViews ?? [])
        .filter((v) => v.story_id === active.id)
        .map((v) => hub.profileById(v.viewer_id))
        .filter((p): p is NonNullable<typeof p> => !!p)
    : [];
  const kind = active?.kind || (active?.media_url ? "photo" : "text");

  const close = () => {
    setOpenAuthor(null);
    setIndex(0);
  };

  const go = (next: number) => {
    if (next < 0) return;
    if (next >= sequence.length) close();
    else setIndex(next);
  };

  useEffect(() => {
    if (!active) return;
    if (kind === "video") return;
    setProgress(0);
    void hub.viewStory(active.id);
    const ms = kind === "text" ? 6500 : 7000;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const pct = Math.min(100, ((Date.now() - started) / ms) * 100);
      setProgress(pct);
      if (pct >= 100) {
        window.clearInterval(timer);
        setIndex((i) => {
          if (i + 1 < sequence.length) return i + 1;
          setOpenAuthor(null);
          return 0;
        });
      }
    }, 80);
    return () => window.clearInterval(timer);
  }, [active?.id, kind]);

  const publish = async () => {
    if (!draft) return;
    try {
      await hub.addStory({ kind: draft.kind, blob: draft.blob, caption: draft.caption });
      if (draft.preview.startsWith("blob:")) URL.revokeObjectURL(draft.preview);
      setDraft(null);
      setCompose(false);
      toast.success("Story added. It expires in 24 hours.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post story");
    }
  };

  return (
    <div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        <button type="button" className="flex w-16 shrink-0 flex-col items-center gap-1 text-xs font-semibold" onClick={() => setCompose(true)}>
          <span className="flex size-14 items-center justify-center rounded-full border border-dashed border-primary text-primary">
            <Plus className="size-5" />
          </span>
          Story
        </button>
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              const blob = await compressImage(file, 1080, 0.62);
              setDraft({ kind: "photo", blob, preview: URL.createObjectURL(blob), caption: "" });
              setCompose(false);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not use that photo");
            }
          }}
        />
        <input
          ref={videoRef}
          type="file"
          accept="video/mp4,video/webm"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              if (file.size > 1_200_000) throw new Error("Keep videos under 1.2 MB.");
              const duration = await videoLength(file);
              if (duration > 8.2) throw new Error("Stories videos must be 8 seconds or shorter.");
              setDraft({ kind: "video", blob: file, preview: URL.createObjectURL(file), caption: "" });
              setCompose(false);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not use that video");
            }
          }}
        />
        {rings.map(([authorId, items]) => {
          const who = hub.profileById(authorId);
          if (!who) return null;
          return (
            <button
              key={authorId}
              type="button"
              className="flex w-16 shrink-0 flex-col items-center gap-1"
              onClick={() => {
                setIndex(0);
                setOpenAuthor(authorId);
              }}
            >
              <span className="rounded-full bg-gradient-to-br from-accent to-primary p-0.5">
                <UserAvatar profile={who} size={52} />
              </span>
              <span className="w-full truncate text-center text-[10px] font-semibold">
                {who.full_name.split(" ")[0]}
                {items.length > 1 ? ` · ${items.length}` : ""}
              </span>
            </button>
          );
        })}
      </div>

      {compose && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center" onClick={() => setCompose(false)}>
          <div className="w-full max-w-sm rounded-xl bg-card p-4 shadow-soft" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold">New story</h3>
            <p className="mt-1 text-sm text-muted-foreground">One ring on your profile. Expires in 24 hours. {hub.usageLeft("story")} left today.</p>
            <div className="mt-4 grid gap-2">
              <Button type="button" onClick={() => photoRef.current?.click()}>Photo</Button>
              <Button type="button" variant="outline" onClick={() => videoRef.current?.click()}>Short video</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft({ kind: "text", blob: null, preview: "", caption: "" });
                  setCompose(false);
                }}
              >
                Text only
              </Button>
            </div>
          </div>
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center">
          <div className="w-full max-w-sm space-y-3 rounded-xl bg-card p-4 shadow-soft">
            <h3 className="font-display text-lg font-semibold">{draft.kind === "text" ? "Text story" : "Add a caption"}</h3>
            {draft.kind === "photo" && <img src={draft.preview} alt="" className="max-h-56 w-full rounded-lg object-cover" />}
            {draft.kind === "video" && <video src={draft.preview} className="max-h-56 w-full rounded-lg bg-ink" muted playsInline controls />}
            <Textarea
              maxLength={140}
              placeholder={draft.kind === "text" ? "Write a short note" : "Optional caption"}
              value={draft.caption}
              onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (draft.preview.startsWith("blob:")) URL.revokeObjectURL(draft.preview);
                  setDraft(null);
                }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={() => void publish()}>Post</Button>
            </div>
          </div>
        </div>
      )}

      {active && author && (
        <div className="fixed inset-0 z-50 flex flex-col bg-ink text-white">
          <div className="flex gap-1 px-2 pt-2">
            {sequence.map((s, i) => (
              <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
                <div className="h-full bg-white" style={{ width: i < index ? "100%" : i === index ? `${progress}%` : "0%" }} />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <UserAvatar profile={author} size={36} />
              <div>
                <p className="text-sm font-semibold">{author.full_name}</p>
                <p className="text-[11px] text-white/70">
                  {index + 1} of {sequence.length}
                  {mine ? ` · ${viewers.length} view${viewers.length === 1 ? "" : "s"}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {mine && (
                <button
                  type="button"
                  className="rounded-md p-2 hover:bg-white/10"
                  onClick={() => {
                    void hub.deleteStory(active.id).then(() => {
                      if (sequence.length <= 1) close();
                      else setIndex((i) => Math.max(0, Math.min(i, sequence.length - 2)));
                      toast.success("Story deleted");
                    });
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              )}
              <button type="button" className="rounded-md p-2 hover:bg-white/10" onClick={close}>
                <X className="size-5" />
              </button>
            </div>
          </div>
          <div className="relative min-h-0 flex-1">
            {kind === "text" ? (
              <div className="flex h-full items-center justify-center bg-navy px-8">
                <p className="max-w-md text-center font-display text-3xl font-semibold leading-snug">{active.caption}</p>
              </div>
            ) : kind === "video" ? (
              <video
                key={active.id}
                src={active.media_url}
                className="mx-auto h-full max-h-[70vh] w-full object-contain"
                autoPlay
                playsInline
                onPlay={() => void hub.viewStory(active.id)}
                onTimeUpdate={(e) => {
                  const el = e.currentTarget;
                  if (el.duration) setProgress((el.currentTime / el.duration) * 100);
                }}
                onEnded={() => go(index + 1)}
              />
            ) : (
              <img src={active.media_url} alt="" className="size-full object-contain" />
            )}
            {kind !== "text" && active.caption && (
              <p className="pointer-events-none absolute inset-x-0 bottom-24 bg-gradient-to-t from-black/70 to-transparent px-6 pb-3 pt-10 text-center text-sm">
                {active.caption}
              </p>
            )}
            <button type="button" className="absolute inset-y-0 left-0 w-1/3" aria-label="Previous story" onClick={() => go(index - 1)} />
            <button type="button" className="absolute inset-y-0 right-0 w-1/3" aria-label="Next story" onClick={() => go(index + 1)} />
          </div>
          {mine ? (
            <div className="max-h-28 overflow-y-auto border-t border-white/10 px-4 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Viewed by</p>
              {viewers.length === 0 ? (
                <p className="mt-1 text-sm text-white/70">No views yet.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {viewers.map((v) => (
                    <li key={v.id}>{v.full_name}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <form
              className="flex items-center gap-2 border-t border-white/10 px-3 py-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const input = (e.currentTarget.elements.namedItem("reply") as HTMLInputElement);
                const text = input.value.trim();
                if (!text) return;
                try {
                  const cid = await hub.openConversation(author.id);
                  await hub.sendMessage(cid, text);
                  input.value = "";
                  toast.success("Reply sent in chat");
                  close();
                  await nav({ to: "/hub/messages/$id", params: { id: cid } });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not reply");
                }
              }}
            >
              <div className="flex gap-1">
                {["❤️", "😂", "😮", "😢", "🙏", "🔥"].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="text-lg"
                    onClick={() => {
                      void hub.openConversation(author.id).then(async (cid) => {
                        await hub.sendMessage(cid, emoji);
                        toast.success("Reaction sent");
                      }).catch((err) => toast.error(err instanceof Error ? err.message : "Add them as a friend to reply"));
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <input
                name="reply"
                placeholder="Reply"
                className="h-10 flex-1 rounded-full border border-white/30 bg-transparent px-4 text-sm outline-none placeholder:text-white/60"
              />
            </form>
          )}
        </div>
      )}
    </div>
  );
}
