import { ImagePlus, Mic, SendHorizontal, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CHAT_AUDIO_MAX, CHAT_AUDIO_SECONDS, CHAT_IMAGE_MAX, clock } from "@/lib/chat";
import { blobToDataUrl, compressImage } from "@/lib/image";
import { REACTIONS } from "@/lib/platform";
import { cn } from "@/lib/utils";

export type ChatSend = {
  text: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  audioSeconds?: number | null;
};

export function ChatWallpaper({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "bg-[#efe7de] bg-[radial-gradient(rgba(11,20,26,0.06)_0.7px,transparent_0.7px)] bg-[length:14px_14px] dark:bg-[#0b141a] dark:bg-[radial-gradient(rgba(255,255,255,0.04)_0.7px,transparent_0.7px)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ChatBubble({
  own,
  body,
  imageUrl,
  audioUrl,
  audioSeconds,
  createdAt,
  ticks,
  name,
  reacts,
  onReact,
  onDelete,
}: {
  own: boolean;
  body: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  audioSeconds?: number | null;
  createdAt: string;
  ticks?: string | null;
  name?: string | null;
  reacts?: string[];
  onReact?: (emoji: string) => void;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("flex", own ? "justify-end" : "justify-start")}>
      <div className="max-w-[82%]">
        {name && !own && <p className="mb-0.5 px-1 text-[11px] font-semibold text-[#1fa855]">{name}</p>}
        <div
          className={cn(
            "rounded-lg px-2 py-1 text-[14.5px] leading-snug shadow-sm",
            own
              ? "rounded-br-sm bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]"
              : "rounded-bl-sm bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef]",
          )}
        >
          {imageUrl && <img src={imageUrl} alt="" className="mb-1 max-h-52 rounded-md object-cover" />}
          {audioUrl && (
            <div className="flex items-center gap-2 py-1">
              <audio src={audioUrl} controls preload="none" className="h-8 max-w-[210px]" />
              {audioSeconds ? <span className="text-[11px] opacity-70">{audioSeconds}s</span> : null}
            </div>
          )}
          {body && <p className="whitespace-pre-wrap break-words">{body}</p>}
          <span className="float-right ml-3 mt-1 flex items-center gap-1 text-[10px] text-[#667781] dark:text-[#ffffff99]">
            {clock(createdAt)}
            {own && ticks && <span>{ticks}</span>}
          </span>
          <span className="clear-both block" />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1 px-1">
          {reacts?.map((emoji, i) => (
            <span key={`${emoji}-${i}`} className="rounded-full bg-white/80 px-1 text-xs dark:bg-[#202c33]">
              {emoji}
            </span>
          ))}
          {onReact && (
            <button type="button" className="text-[11px] font-semibold text-[#667781]" onClick={() => setOpen((v) => !v)}>
              React
            </button>
          )}
          {onDelete && (
            <button type="button" className="text-[11px] font-semibold text-[#667781]" onClick={onDelete}>
              Delete
            </button>
          )}
        </div>
        {open && onReact && (
          <div className="mt-1 flex w-fit gap-1 rounded-full bg-white px-2 py-1 shadow-sm dark:bg-[#202c33]">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="text-base"
                onClick={() => {
                  setOpen(false);
                  onReact(emoji);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatComposer({ onSend }: { onSend: (input: ChatSend) => Promise<void> }) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      recRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  const send = async (input: ChatSend) => {
    setBusy(true);
    try {
      await onSend(input);
      setText("");
    } finally {
      setBusy(false);
    }
  };

  const pickImage = async (file: File | null) => {
    if (!file) return;
    const blob = await compressImage(file, 640, 0.5);
    if (blob.size > CHAT_IMAGE_MAX) throw new Error("That photo is still too large. Try a smaller one.");
    await send({ text: text.trim(), imageUrl: await blobToDataUrl(blob) });
  };

  const stopRec = () => {
    recRef.current?.stop();
  };

  const startRec = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 16000 } : undefined);
    chunks.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data);
    };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timer.current) window.clearInterval(timer.current);
      const taken = secondsRef.current;
      setRecording(false);
      const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
      if (blob.size < 800) return;
      if (blob.size > CHAT_AUDIO_MAX) {
        window.alert("Voice note is too long for the free plan. Keep it under 20 seconds.");
        return;
      }
      void blobToDataUrl(blob).then((audioUrl) => send({ text: "", audioUrl, audioSeconds: Math.max(1, taken) }));
    };
    recRef.current = rec;
    secondsRef.current = 0;
    setSeconds(0);
    setRecording(true);
    rec.start();
    timer.current = window.setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      if (secondsRef.current >= CHAT_AUDIO_SECONDS) rec.stop();
    }, 1000);
  };

  const secondsRef = useRef(0);

  return (
    <form
      className="flex items-end gap-1.5 bg-[#f0f2f5] px-2 py-1.5 dark:bg-[#1f2c33]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim() || busy) return;
        void send({ text: text.trim() }).catch((err) => window.alert(err instanceof Error ? err.message : "Could not send"));
      }}
    >
      <label className="mb-1 flex size-9 cursor-pointer items-center justify-center rounded-full text-[#54656f] hover:bg-black/5 dark:text-[#e9edef]">
        <ImagePlus className="size-5" />
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            e.target.value = "";
            void pickImage(file).catch((err) => window.alert(err instanceof Error ? err.message : "Could not send photo"));
          }}
        />
      </label>
      {recording ? (
        <div className="mb-1 flex h-10 flex-1 items-center rounded-full bg-white px-3 text-sm text-red-600 dark:bg-[#2a3942]">
          Recording {seconds}s · max {CHAT_AUDIO_SECONDS}s
        </div>
      ) : (
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message"
          className="mb-1 h-10 flex-1 rounded-full border-0 bg-white px-4 text-sm text-[#111b21] outline-none dark:bg-[#2a3942] dark:text-[#e9edef]"
        />
      )}
      {text.trim() && !recording ? (
        <button type="submit" disabled={busy} className="mb-1 flex size-10 items-center justify-center rounded-full bg-[#00a884] text-white" aria-label="Send">
          <SendHorizontal className="size-5" />
        </button>
      ) : (
        <button
          type="button"
          className={cn("mb-1 flex size-10 items-center justify-center rounded-full text-white", recording ? "bg-red-600" : "bg-[#00a884]")}
          aria-label={recording ? "Stop voice note" : "Record voice note"}
          onClick={() => {
            if (recording) stopRec();
            else void startRec().catch(() => window.alert("Allow the microphone to send a voice note."));
          }}
        >
          {recording ? <Square className="size-4" /> : <Mic className="size-5" />}
        </button>
      )}
    </form>
  );
}
