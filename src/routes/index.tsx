import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Landmark,
  MapPin,
  Moon,
  Sun,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  CAMPUS,
  CONTACT_EMAIL,
  CONTACT_PHONE,
  ESTABLISHED,
  LEADERSHIP,
  MISSION,
  RECTOR_WELCOME,
  SCHOOLS,
  SCHOOL_NAME,
  SCHOOL_SHORT,
  VISION,
} from "@/lib/constants";
import { useHub } from "@/lib/hub";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const hub = useHub();
  const [dark, setDark] = useState(false);
  const images = hub.db.settings?.images;
  const hero = images?.hero || "/campus/hero.jpg";
  const officerImage = (title: string, fallback: string) => {
    if (!images) return fallback;
    if (title === "Rector") return images.rector || fallback;
    if (title === "Registrar") return images.registrar || fallback;
    if (title.startsWith("Deputy Rector, Academics")) return images.deputyAcademics || fallback;
    if (title.startsWith("Deputy Rector, Administration")) return images.deputyAdmin || fallback;
    if (title === "Librarian") return images.librarian || fallback;
    if (title === "Bursar") return images.bursar || fallback;
    return fallback;
  };
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="flex h-1 w-full">
        <span className="flex-1 bg-navy" />
        <span className="flex-1 bg-forest" />
        <span className="flex-1 bg-accent" />
      </div>
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Wordmark />
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <a href="#about" className="hover:text-primary">About</a>
            <a href="#schools" className="hover:text-primary">Schools</a>
            <a href="#officers" className="hover:text-primary">Officers</a>
            <a href="#hub" className="hover:text-primary">The Hub</a>
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex size-10 items-center justify-center rounded-md hover:bg-muted"
              aria-label="Toggle theme"
              onClick={() => {
                const next = !document.documentElement.classList.contains("dark");
                document.documentElement.classList.toggle("dark", next);
                localStorage.setItem("byspoly-theme", next ? "dark" : "light");
                setDark(next);
              }}
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            {hub.me ? (
              <Link to="/hub">
                <Button>Open hub</Button>
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden sm:block">
                  <Button variant="ghost">Sign in</Button>
                </Link>
                <Link to="/signup">
                  <Button>Join campus</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative isolate min-h-[78vh] overflow-hidden">
        <img
          src={hero}
          alt="Aleibiri campus at dusk"
          className="absolute inset-0 size-full object-cover object-center"
          onLoad={() => window.dispatchEvent(new Event("byspoly-landing-ready"))}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-navy/92 via-navy/68 to-navy/25" />
        <div className="relative mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-end px-4 py-16 text-navy-foreground">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-navy-foreground/80">
            {SCHOOL_SHORT} · Aleibiri · Est. {ESTABLISHED}
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            The official social hub for Bayelsa State Polytechnic.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-navy-foreground/85 sm:text-lg">
            Notices, clubs, events and conversations for students, staff and alumni of {SCHOOL_NAME}, Aleibiri.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup">
              <Button size="lg" className="bg-card text-navy hover:bg-card/90">
                Create your campus account
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="border-navy-foreground/30 bg-transparent text-navy-foreground hover:bg-navy-foreground/10">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px sm:grid-cols-4">
          {[
            ["2014", "Established"],
            ["4", "Schools"],
            ["7", "Departments"],
            ["Aleibiri", "Home campus"],
          ].map(([k, v]) => (
            <div key={v} className="px-6 py-7">
              <div className="font-display text-2xl font-semibold text-primary">{k}</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{v}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="about" className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Rector’s welcome</p>
          <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Wisdom Clinton Soreh</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{RECTOR_WELCOME}</p>
          <p className="mt-4 flex items-center gap-2 text-sm text-foreground">
            <MapPin className="size-4 text-primary" /> {CAMPUS}
          </p>
        </div>
        <figure className="overflow-hidden rounded-2xl bg-card shadow-soft">
          <img src={images?.rector || "/leadership/rector.jpg"} alt="Rector Wisdom Clinton Soreh" className="aspect-[4/5] w-full object-cover object-[center_18%]" />
          <figcaption className="px-5 py-4">
            <div className="font-semibold">Mr. Wisdom Clinton Soreh</div>
            <div className="text-sm text-muted-foreground">HND, MBA, MSc · Rector</div>
          </figcaption>
        </figure>
      </section>

      <section className="bg-navy text-navy-foreground">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-2">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-navy-foreground/70">
              <Landmark className="size-4" /> Mission
            </div>
            <p className="mt-3 font-display text-2xl leading-snug">{MISSION}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-navy-foreground/70">
              <GraduationCap className="size-4" /> Vision
            </div>
            <p className="mt-3 font-display text-2xl leading-snug">{VISION}</p>
          </div>
        </div>
      </section>

      <section id="schools" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl font-semibold">Schools & departments</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Seven departments across engineering, applied science, commerce and foundation studies.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {SCHOOLS.map((s) => (
            <article key={s.name} className="rounded-xl bg-card p-5 shadow-soft">
              <h3 className="font-display text-xl font-semibold">{s.name}</h3>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {s.departments.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="officers" className="border-y border-border bg-card/60 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-semibold">Principal officers</h2>
          <p className="mt-2 text-sm text-muted-foreground">The current administration of {SCHOOL_NAME}.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LEADERSHIP.map((p) => (
              <article key={p.title} className="overflow-hidden rounded-xl bg-card shadow-soft">
                <div className="aspect-[4/5] overflow-hidden bg-muted">
                  <img src={officerImage(p.title, p.image)} alt={p.name} className="size-full object-cover object-[center_20%]" />
                </div>
                <div className="p-4">
                  <h3 className="font-display text-lg font-semibold leading-snug">{p.name}</h3>
                  <p className="mt-1 text-sm font-medium text-primary">{p.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{p.credentials}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="hub" className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-forest">Campus life, online</p>
          <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">A hub with the discipline of a notice board and the warmth of a common room.</h2>
          <ul className="mt-6 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <li>Official announcements, pinned and badged.</li>
            <li>Departmental clubs, events and RSVP.</li>
            <li>Direct messages between verified campus accounts.</li>
            <li>Admin tools for verification, reports and safety.</li>
          </ul>
          <Link to="/signup" className="mt-8 inline-flex">
            <Button size="lg">
              Join Byspolyhub <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <img src={images?.workshop || "/campus/workshop.jpg"} alt="Engineering workshop" className="h-48 w-full rounded-xl object-cover sm:h-56" />
          <img src={images?.library || "/campus/library.jpg"} alt="Library" className="mt-8 h-48 w-full rounded-xl object-cover sm:h-56" />
          <img src={images?.sports || "/campus/sports.jpg"} alt="Sports field" className="h-48 w-full rounded-xl object-cover sm:h-56" />
          <img src={images?.auditorium || "/campus/auditorium.jpg"} alt="Auditorium" className="mt-8 h-48 w-full rounded-xl object-cover sm:h-56" />
        </div>
      </section>

      <footer className="border-t border-border bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-sm text-sm text-navy-foreground/75">
              {SCHOOL_NAME}, Aleibiri. Not a substitute for the academic portal — a civic layer for campus life.
            </p>
          </div>
          <div className="text-sm">
            <div className="flex items-center gap-2"><BookOpen className="size-4" /> {CONTACT_EMAIL}</div>
            <div className="mt-1">{CONTACT_PHONE} · Mon–Sat 8:00–18:00</div>
            <Link to="/articles" className="mt-3 block text-navy-foreground/80 underline-offset-2 hover:underline">
              Campus articles
            </Link>
            <Link to="/p/$slug" params={{ slug: "about" }} className="mt-1 block text-navy-foreground/80 underline-offset-2 hover:underline">
              About
            </Link>
            <Link to="/p/$slug" params={{ slug: "privacy" }} className="mt-1 block text-navy-foreground/80 underline-offset-2 hover:underline">
              Privacy
            </Link>
            <Link to="/p/$slug" params={{ slug: "guidelines" }} className="mt-1 block text-navy-foreground/80 underline-offset-2 hover:underline">
              Community guidelines
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
