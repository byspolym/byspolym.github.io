import { createFileRoute, Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/brand/logo";
import { useHub } from "@/lib/hub";

export const Route = createFileRoute("/articles/$slug")({ component: ArticlePage });

function ArticlePage() {
  const { slug } = Route.useParams();
  const hub = useHub();
  const article = hub.db.articles.find((a) => a.slug === slug && a.published);
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link to="/"><Wordmark /></Link>
          <Link to="/articles" className="text-sm font-semibold text-primary">All articles</Link>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-4 py-10">
        {article ? (
          <>
            {article.cover_url && <img src={article.cover_url} alt="" className="mb-6 max-h-80 w-full rounded-xl object-cover" />}
            <h1 className="font-display text-4xl font-semibold">{article.title}</h1>
            <p className="mt-6 whitespace-pre-wrap text-[16px] leading-relaxed">{article.body}</p>
          </>
        ) : (
          <p>Article not found.</p>
        )}
      </article>
    </div>
  );
}
