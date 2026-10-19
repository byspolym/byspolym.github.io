import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Composer } from "@/components/feed/composer";
import { PostCard } from "@/components/feed/post-card";
import { StoriesBar } from "@/components/feed/stories";
import { Button } from "@/components/ui/button";
import { PAGE_SIZE } from "@/lib/constants";
import { useHub } from "@/lib/hub";

export const Route = createFileRoute("/hub/")({ component: FeedPage });

function FeedPage() {
  const hub = useHub();
  const [page, setPage] = useState(0);
  const posts = hub.feed({ page });
  const total = hub.db.posts.filter((p) => !p.group_id).length;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Campus feed</h1>
        <p className="text-sm text-muted-foreground">Official notices stay pinned. Everything else is campus conversation.</p>
      </div>
      <Composer />
      <StoriesBar />
      {posts.length === 0 && (
        <div className="rounded-xl bg-card p-8 text-center text-sm text-muted-foreground shadow-soft">
          No posts yet. Be the first to write something useful.
        </div>
      )}
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
      {(page + 1) * PAGE_SIZE < total && (
        <Button variant="outline" className="w-full" onClick={() => setPage((n) => n + 1)}>
          Load more
        </Button>
      )}
    </div>
  );
}
