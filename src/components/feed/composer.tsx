import { useRef, useState } from "react";
import { ImagePlus, Megaphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/avatar";
import { useHub } from "@/lib/hub";
import { compressImage } from "@/lib/image";
import { toast } from "sonner";

export function Composer({ groupId = null }: { groupId?: string | null }) {
  const hub = useHub();
  const me = hub.me;
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [announce, setAnnounce] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!me || me.is_banned) return null;

  return (
    <div className="rounded-xl bg-card p-4 shadow-soft sm:p-5">
      <div className="flex gap-3">
        <UserAvatar profile={me} />
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={groupId ? "Share with this club…" : "Share something with campus…"}
          className="min-h-[88px]"
        />
      </div>
      {previews.length > 0 && (
        <div className="relative mt-3 grid grid-cols-2 gap-2">
          {files.map((f, i) => (
            <div key={previews[i]} className="overflow-hidden rounded-lg bg-muted">
              {f.type.startsWith("video") ? (
                <video src={previews[i]} className="max-h-40 w-full object-cover" muted />
              ) : f.type.startsWith("audio") ? (
                <audio src={previews[i]} controls className="w-full p-2" />
              ) : (
                <img src={previews[i]} alt="" className="max-h-40 w-full object-cover" />
              )}
            </div>
          ))}
          <button
            type="button"
            className="absolute right-2 top-2 rounded-full bg-ink/70 p-1 text-paper"
            onClick={() => {
              setFiles([]);
              setPreviews([]);
            }}
            aria-label="Remove media"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const list = Array.from(e.target.files ?? []).slice(0, 4);
              setFiles(list);
              setPreviews(list.map((f) => URL.createObjectURL(f)));
            }}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
            <ImagePlus /> Media
          </Button>
          {me.role === "admin" && !groupId && (
            <Button
              type="button"
              variant={announce ? "accent" : "ghost"}
              size="sm"
              onClick={() => setAnnounce((v) => !v)}
            >
              <Megaphone /> Official
            </Button>
          )}
        </div>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const prepared: Blob[] = [];
              for (const f of files) {
                prepared.push(f.type.startsWith("image/") ? await compressImage(f) : f);
              }
              await hub.createPost({
                content,
                files: prepared,
                groupId,
                announcement: announce,
              });
              setContent("");
              setFiles([]);
              setPreviews([]);
              setAnnounce(false);
              toast.success(announce ? "Announcement published" : "Posted");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Could not post");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Posting…" : announce ? "Publish notice" : "Post"}
        </Button>
      </div>
    </div>
  );
}
