import { createFileRoute, Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/brand/logo";
import { useHub } from "@/lib/hub";

export const Route = createFileRoute("/p/$slug")({ component: PageView });

function PageView() {
  const { slug } = Route.useParams();
  const hub = useHub();
  const page = hub.db.pages.find((p) => p.slug === slug);
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4">
          <Link to="/"><Wordmark /></Link>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-4 py-10">
        {page ? (
          <>
            <h1 className="font-display text-4xl font-semibold">{page.title}</h1>
            <p className="mt-6 whitespace-pre-wrap text-[15px] leading-relaxed text-muted-foreground">{page.body}</p>
          </>
        ) : (
          <p>This page is not published.</p>
        )}
      </article>
    </div>
  );
}
