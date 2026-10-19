import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChatBubble, ChatComposer, ChatWallpaper } from "@/components/chat/thread";
import { Composer } from "@/components/feed/composer";
import { PostCard } from "@/components/feed/post-card";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Textarea } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/avatar";
import { chatAlive } from "@/lib/chat";
import { useHub } from "@/lib/hub";
import { compressImage } from "@/lib/image";
import { toast } from "sonner";

export const Route = createFileRoute("/hub/groups/$id")({ component: GroupPage });

function GroupPage() {
  const { id } = Route.useParams();
  const hub = useHub();
  const nav = useNavigate();
  const endRef = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pane, setPane] = useState<"chat" | "board">("chat");

  const group = hub.db.groups.find((g) => g.id === id);
  const members = hub.db.groupMembers.filter((m) => m.group_id === id);
  const me = hub.me;
  const mine = members.find((m) => m.user_id === me?.id);
  const joined = !!mine;
  const canManage = me?.role === "admin" || mine?.role === "owner" || mine?.role === "admin";
  const messages = (hub.db.groupMessages ?? []).filter((m) => m.group_id === id && chatAlive(m));
  const board = hub.feed({ groupId: id });

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description);
    }
  }, [group?.id, group?.name, group?.description]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, pane]);

  if (!group) return <p className="text-sm text-muted-foreground">Group not found.</p>;

  return (
    <div className="flex h-[78vh] flex-col overflow-hidden rounded-xl bg-card shadow-soft">
      <header className="flex items-center gap-3 bg-[#075e54] px-3 py-2 text-white dark:bg-[#1f2c33]">
        <Link to="/hub/groups" className="text-sm font-semibold">
          Back
        </Link>
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20">
          {group.avatar_url ? <img src={group.avatar_url} alt="" className="size-full object-cover" /> : <span className="text-sm font-semibold">{group.name.slice(0, 1)}</span>}
        </span>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setInfo(true)}>
          <p className="truncate font-semibold">{group.name}</p>
          <p className="truncate text-[11px] text-white/75">{members.length} members</p>
        </button>
        <Button size="sm" variant="outline" className="border-white/30 bg-transparent text-white" onClick={() => setInfo(true)}>
          <Settings2 className="size-4" /> Info
        </Button>
      </header>
      <div className="flex gap-2 border-b border-border bg-[#f0f2f5] px-3 py-2 dark:bg-[#111b21]">
        <Button size="sm" variant={pane === "chat" ? "default" : "outline"} onClick={() => setPane("chat")}>Chat</Button>
        <Button size="sm" variant={pane === "board" ? "default" : "outline"} onClick={() => setPane("board")}>Posts</Button>
      </div>

      {pane === "board" ? (
        <div className="flex-1 space-y-3 overflow-y-auto bg-muted/40 p-3">
          {joined ? <Composer groupId={id} /> : <p className="text-sm text-muted-foreground">Join the club to post.</p>}
          {board.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No club posts yet.</p>}
          {board.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <ChatWallpaper className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
            <p className="mx-auto mb-2 w-fit rounded-md bg-[#fff3c4] px-2 py-1 text-center text-[11px] text-[#54656f]">
              Group messages disappear after 7 days.
            </p>
            {messages.length === 0 && <p className="py-8 text-center text-sm text-[#667781]">No messages yet. Say hello.</p>}
            {messages.map((m) => {
              const sender = hub.profileById(m.sender_id);
              const own = m.sender_id === me?.id;
              const reacts = (hub.db.groupMessageReactions ?? []).filter((r) => r.message_id === m.id).map((r) => r.emoji);
              return (
                <ChatBubble
                  key={m.id}
                  own={own}
                  name={sender?.full_name}
                  body={m.body}
                  imageUrl={m.image_url}
                  audioUrl={m.audio_url}
                  audioSeconds={m.audio_seconds}
                  createdAt={m.created_at}
                  reacts={reacts}
                  onReact={joined ? (emoji) => void hub.reactToGroupMessage(m.id, emoji) : undefined}
                  onDelete={joined && (own || canManage) ? () => void hub.deleteGroupMessage(m.id).catch((err) => toast.error(err instanceof Error ? err.message : "Could not delete")) : undefined}
                />
              );
            })}
            <div ref={endRef} />
          </ChatWallpaper>
          {joined ? (
            <ChatComposer
              onSend={async (input) => {
                await hub.sendGroupMessage(id, input.text, {
                  imageUrl: input.imageUrl,
                  audioUrl: input.audioUrl,
                  audioSeconds: input.audioSeconds,
                });
              }}
            />
          ) : (
            <div className="border-t border-border p-3">
              <Button className="w-full" onClick={() => void hub.joinGroup(id).then(() => toast.success("You joined")).catch((err) => toast.error(err instanceof Error ? err.message : "Could not join"))}>
                Join to chat
              </Button>
            </div>
          )}
        </div>
      )}

      {info && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={() => setInfo(false)}>
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-xl bg-card p-5 shadow-soft sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
            {group.cover_url && <img src={group.cover_url} alt="" className="mb-3 h-28 w-full rounded-lg object-cover" />}
            <h2 className="font-display text-xl font-semibold">{group.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Members</h3>
            <ul className="mt-2 space-y-2">
              {members.map((m) => {
                const person = hub.profileById(m.user_id);
                if (!person) return null;
                return (
                  <li key={m.user_id} className="flex items-center gap-2">
                    <UserAvatar profile={person} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{person.full_name}</p>
                      <p className="text-[11px] capitalize text-muted-foreground">{m.role}</p>
                    </div>
                    {canManage && m.role !== "owner" && m.user_id !== me?.id && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => void hub.setGroupMemberRole(id, m.user_id, m.role === "admin" ? "member" : "admin")}>
                          {m.role === "admin" ? "Demote" : "Admin"}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => void hub.removeGroupMember(id, m.user_id)}>Remove</Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {canManage && (
              <form
                className="mt-4 space-y-2 border-t border-border pt-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const avatar = (form.elements.namedItem("avatar") as HTMLInputElement).files?.[0];
                  const cover = (form.elements.namedItem("cover") as HTMLInputElement).files?.[0];
                  try {
                    await hub.updateGroup(id, {
                      name,
                      description,
                      avatar: avatar ? await compressImage(avatar, 512, 0.7) : null,
                      cover: cover ? await compressImage(cover, 1280, 0.62) : null,
                    });
                    toast.success("Group updated");
                    setInfo(false);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not update");
                  }
                }}
              >
                <FieldLabel>Name</FieldLabel>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
                <FieldLabel>About</FieldLabel>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                <FieldLabel>Profile photo</FieldLabel>
                <Input name="avatar" type="file" accept="image/*" />
                <FieldLabel>Cover photo</FieldLabel>
                <Input name="cover" type="file" accept="image/*" />
                <Button type="submit">Save group</Button>
              </form>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {joined && mine?.role !== "owner" && (
                <Button variant="outline" onClick={() => void hub.leaveGroup(id).then(() => toast.success("You left"))}>Leave</Button>
              )}
              {canManage && (
                <Button variant="destructive" onClick={() => void hub.deleteGroup(id).then(async () => { toast.success("Group deleted"); await nav({ to: "/hub/groups" }); })}>
                  Delete group
                </Button>
              )}
              <Button variant="ghost" onClick={() => setInfo(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
