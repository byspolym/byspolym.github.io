import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Wordmark } from "@/components/brand/logo";
import { useHub } from "@/lib/hub";

export const Route = createFileRoute("/articles")({ component: ArticlesRoute });

function ArticlesRoute() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/articles") return <Outlet />;
  return <ArticlesPage />;
}

function ArticlesPage() {
  const hub = useHub();
  const articles = hub.db.articles.filter((a) => a.published);
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4">
          <Link to="/"><Wordmark /></Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <h1 className="font-display text-4xl font-semibold">Campus articles</h1>
        <p className="text-sm text-muted-foreground">Notes from Bayelsa State Polytechnic for readers on and off campus.</p>
        {articles.map((a) => (
          <Link key={a.id} to="/articles/$slug" params={{ slug: a.slug }} className="block overflow-hidden rounded-xl bg-card shadow-soft">
            {a.cover_url && <img src={a.cover_url} alt="" className="h-44 w-full object-cover" />}
            <div className="p-4">
              <h2 className="font-display text-2xl font-semibold">{a.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{a.excerpt}</p>
            </div>
          </Link>
        ))}
      </main>
    </div>
  );
}
