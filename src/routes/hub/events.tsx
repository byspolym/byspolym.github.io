import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Textarea } from "@/components/ui/input";
import { useHub } from "@/lib/hub";
import { compressImage } from "@/lib/image";
import { formatWhen } from "@/lib/utils";
import type { RsvpStatus } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/hub/events")({ component: EventsPage });

function EventsPage() {
  const hub = useHub();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => new Date());
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    starts_at: "",
    ends_at: "",
  });
  const [image, setImage] = useState<File | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editImage, setEditImage] = useState<File | null>(null);

  const monthDays = useMemo(() => buildMonth(cursor), [cursor]);
  const events = [...hub.db.events].sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Campus events</h1>
          <p className="text-sm text-muted-foreground">Matriculation, clubs, clinics and the sporting calendar.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")}>
            List
          </Button>
          <Button variant={view === "calendar" ? "default" : "outline"} size="sm" onClick={() => setView("calendar")}>
            Calendar
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>New event</Button>
        </div>
      </div>

      {view === "calendar" && (
        <div className="rounded-xl bg-card p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <Button variant="ghost" size="icon-sm" onClick={() => setCursor(addMonth(cursor, -1))} aria-label="Previous month">
              <ChevronLeft />
            </Button>
            <h2 className="font-display text-lg font-semibold">
              {cursor.toLocaleDateString("en-NG", { month: "long", year: "numeric" })}
            </h2>
            <Button variant="ghost" size="icon-sm" onClick={() => setCursor(addMonth(cursor, 1))} aria-label="Next month">
              <ChevronRight />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {monthDays.map((cell, i) => {
              const dayEvents = cell
                ? events.filter((e) => sameDay(e.starts_at, cell))
                : [];
              return (
                <div key={i} className="min-h-16 rounded-md bg-muted/40 p-1 text-left">
                  {cell && <div className="text-[11px] font-semibold">{cell.getDate()}</div>}
                  {dayEvents.map((e) => (
                    <div key={e.id} className="mt-0.5 truncate rounded-sm bg-primary px-1 text-[10px] text-primary-foreground">
                      {e.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {events.map((e) => {
          const mine = hub.db.rsvps.find((r) => r.event_id === e.id && r.user_id === hub.me?.id);
          const going = hub.db.rsvps.filter((r) => r.event_id === e.id && r.status === "going").length;
          return (
            <article key={e.id} className="overflow-hidden rounded-xl bg-card shadow-soft sm:grid sm:grid-cols-[220px_minmax(0,1fr)]">
              <div className="h-40 bg-muted sm:h-full">
                {e.image_url && <img src={e.image_url} alt="" className="size-full object-cover" />}
              </div>
              <div className="p-5">
                <h2 className="font-display text-xl font-semibold">{e.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{formatWhen(e.starts_at)} · {e.location}</p>
                <p className="mt-3 text-sm leading-relaxed">{e.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">{going} going</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["going", "maybe", "declined"] as RsvpStatus[]).map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={mine?.status === s ? "default" : "outline"}
                      onClick={() => hub.rsvp(e.id, s)}
                    >
                      {s === "going" ? "Going" : s === "maybe" ? "Maybe" : "Can’t go"}
                    </Button>
                  ))}
                  {hub.me?.role === "admin" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(e.id);
                          setEditTitle(e.title);
                          setEditBody(e.description);
                          setEditImage(null);
                        }}
                      >
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => void hub.deleteEvent(e.id).then(() => toast.success("Event deleted"))}>
                        Delete
                      </Button>
                    </>
                  )}
                </div>
                {editing === e.id && (
                  <form
                    className="mt-4 space-y-2 border-t border-border pt-3"
                    onSubmit={async (ev) => {
                      ev.preventDefault();
                      try {
                        await hub.updateEvent(e.id, {
                          title: editTitle,
                          description: editBody,
                          image: editImage ? await compressImage(editImage, 1280, 0.62) : null,
                        });
                        setEditing(null);
                        toast.success("Event updated");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Could not update event");
                      }
                    }}
                  >
                    <Input value={editTitle} onChange={(ev) => setEditTitle(ev.target.value)} required />
                    <Textarea value={editBody} onChange={(ev) => setEditBody(ev.target.value)} />
                    <Input type="file" accept="image/*" onChange={(ev) => setEditImage(ev.target.files?.[0] || null)} />
                    <div className="flex gap-2">
                      <Button type="submit" size="sm">Save</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                    </div>
                  </form>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <form
            className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-xl bg-card p-5 shadow-soft"
            onSubmit={async (ev) => {
              ev.preventDefault();
              try {
                const blob = image ? await compressImage(image) : null;
                await hub.createEvent({ ...form, image: blob });
                setOpen(false);
                toast.success("Event published");
              } catch (ex) {
                toast.error(ex instanceof Error ? ex.message : "Could not create event");
              }
            }}
          >
            <h3 className="font-display text-lg font-semibold">New event</h3>
            <div>
              <FieldLabel>Title</FieldLabel>
              <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <FieldLabel>Location</FieldLabel>
              <Input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <FieldLabel>Starts</FieldLabel>
                <Input type="datetime-local" required value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              </div>
              <div>
                <FieldLabel>Ends</FieldLabel>
                <Input type="datetime-local" required value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              </div>
            </div>
            <div>
              <FieldLabel>Details</FieldLabel>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <FieldLabel>Image</FieldLabel>
              <Input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] || null)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">Publish</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function addMonth(d: Date, n: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}
function sameDay(iso: string, d: Date) {
  const a = new Date(iso);
  return a.getFullYear() === d.getFullYear() && a.getMonth() === d.getMonth() && a.getDate() === d.getDate();
}
function buildMonth(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = first.getDay();
  const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < start; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
  while (cells.length % 7) cells.push(null);
  return cells;
}
