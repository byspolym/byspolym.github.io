import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { UserAvatar } from "@/components/ui/avatar";
import { ChatBubble, ChatComposer, ChatWallpaper } from "@/components/chat/thread";
import { chatAlive } from "@/lib/chat";
import { useHub } from "@/lib/hub";

export const Route = createFileRoute("/hub/messages/$id")({ component: Thread });

function Thread() {
  const { id } = Route.useParams();
  const hub = useHub();
  const me = hub.me!;
  const endRef = useRef<HTMLDivElement>(null);
  const otherId = hub.db.convMembers.find((m) => m.conversation_id === id && m.user_id !== me.id)?.user_id;
  const other = otherId ? hub.profileById(otherId) : undefined;
  const msgs = hub.db.messages.filter((m) => m.conversation_id === id && chatAlive(m));

  useEffect(() => {
    void hub.markConversationRead(id);
  }, [id, msgs.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  if (!other) return <p className="p-6 text-sm text-muted-foreground">Conversation not found.</p>;

  return (
    <div className="flex h-[74vh] flex-col overflow-hidden">
      <div className="flex items-center gap-3 bg-[#075e54] px-3 py-2 text-white dark:bg-[#1f2c33]">
        <UserAvatar profile={other} size={36} showOnline online={hub.isOnline(other.id)} />
        <div className="min-w-0">
          <Link to="/hub/profile/$id" params={{ id: other.id }} className="block truncate font-semibold">
            {other.full_name}
          </Link>
          <div className="text-[11px] text-white/80">{hub.isOnline(other.id) ? "online" : "last seen recently"}</div>
        </div>
      </div>
      <ChatWallpaper className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        <p className="mx-auto mb-2 w-fit rounded-md bg-[#fff3c4] px-2 py-1 text-center text-[11px] text-[#54656f]">
          Messages disappear after 7 days.
        </p>
        {msgs.map((m) => {
          const mine = m.sender_id === me.id;
          const reacts = (hub.db.messageReactions ?? []).filter((r) => r.message_id === m.id).map((r) => r.emoji);
          return (
            <ChatBubble
              key={m.id}
              own={mine}
              body={m.body}
              imageUrl={m.image_url}
              audioUrl={m.audio_url}
              audioSeconds={m.audio_seconds}
              createdAt={m.created_at}
              ticks={mine ? (m.read_at ? "✓✓" : "✓") : null}
              reacts={reacts}
              onReact={(emoji) => void hub.reactToMessage(m.id, emoji)}
            />
          );
        })}
        <div ref={endRef} />
      </ChatWallpaper>
      <ChatComposer
        onSend={async (input) => {
          await hub.sendMessage(id, input.text, {
            imageUrl: input.imageUrl,
            audioUrl: input.audioUrl,
            audioSeconds: input.audioSeconds,
          });
        }}
      />
    </div>
  );
}
