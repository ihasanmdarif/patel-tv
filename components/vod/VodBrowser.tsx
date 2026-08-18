"use client";

import { useEffect, useMemo, useState } from "react";
import MovieCard from "./MovieCard";
import { buildWatchUrl } from "@/lib/watch-url";
import { FocusableButton } from "@/components/spatial/FocusableButton";
import { FocusableSection } from "@/components/spatial/FocusableSection";
import { useNativeFieldKeys } from "@/components/spatial/useNativeFieldKeys";

type VodCategory = { id: string; title: string };
type VodItem = {
  id: string;
  name: string;
  cmd: string;
  categoryId: string | null;
  isSeries: boolean;
  year: string | null;
};
type Favorite = { contentId: string };

const BATCH_SIZE = 24;

export default function VodBrowser({
  profileId,
  wantSeries,
}: {
  profileId: string;
  wantSeries: boolean;
}) {
  const [categories, setCategories] = useState<VodCategory[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [items, setItems] = useState<VodItem[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const nativeFieldProps = useNativeFieldKeys();

  useEffect(() => {
    fetch(`/api/stalker/${profileId}/vod/categories`)
      .then((res) => res.json())
      .then((data: VodCategory[]) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]));
    fetch(`/api/favorites?profileId=${profileId}&contentType=MOVIE`)
      .then((res) => res.json())
      .then((data: Favorite[]) => setFavoriteIds(new Set(data.map((f) => f.contentId))))
      .catch(() => {});
  }, [profileId]);

  useEffect(() => {
    // Re-fires whenever the category changes, so the loading flag must reset synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setVisibleCount(BATCH_SIZE);
    const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
    fetch(`/api/stalker/${profileId}/vod/items${qs}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load titles");
        setItems(Array.isArray(data) ? data : []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load titles"))
      .finally(() => setLoading(false));
  }, [profileId, categoryId]);

  const filtered = useMemo(() => {
    return items
      .filter((i) => i.isSeries === wantSeries)
      .filter((i) => !favoritesOnly || favoriteIds.has(i.id))
      .filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()));
  }, [items, wantSeries, favoritesOnly, favoriteIds, search]);

  async function toggleFavorite(item: VodItem) {
    const isFav = favoriteIds.has(item.id);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
    if (isFav) {
      await fetch(
        `/api/favorites?profileId=${profileId}&contentType=MOVIE&contentId=${item.id}`,
        { method: "DELETE" }
      );
    } else {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          contentType: "MOVIE",
          contentId: item.id,
          cmd: item.cmd,
          title: item.name,
        }),
      });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          {...nativeFieldProps}
          className="rounded-[10px] border border-surface-border bg-bg-tertiary px-3 py-2.5 text-base outline-none focus:border-accent"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          {...nativeFieldProps}
          className="min-w-48 rounded-[10px] border border-surface-border bg-bg-tertiary px-3 py-2.5 text-base outline-none focus:border-accent"
        />
        <FocusableButton
          onActivate={() => setFavoritesOnly((v) => !v)}
          className={`rounded-[10px] px-3.5 py-2.5 text-base font-medium transition ${
            favoritesOnly ? "bg-accent-dim text-accent" : "border border-surface-border text-muted"
          }`}
        >
          Favorites only
        </FocusableButton>
      </div>

      {loading && <p className="text-sm text-muted">Loading...</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <p className="text-sm text-muted">Nothing to show here.</p>
      )}

      <FocusableSection as="div" className="flex flex-wrap gap-4">
        {filtered.slice(0, visibleCount).map((item) => (
          <MovieCard
            key={item.id}
            title={item.name}
            subtitle={item.year}
            favorited={favoriteIds.has(item.id)}
            onToggleFavorite={() => toggleFavorite(item)}
            href={
              wantSeries
                ? `/series/${item.id}?${new URLSearchParams({ title: item.name }).toString()}`
                : buildWatchUrl({
                    cmd: item.cmd,
                    type: "vod",
                    contentType: "MOVIE",
                    contentId: item.id,
                    title: item.name,
                  })
            }
          />
        ))}
      </FocusableSection>

      {visibleCount < filtered.length && (
        <FocusableButton
          onActivate={() => setVisibleCount((v) => v + BATCH_SIZE)}
          className="self-center rounded-[10px] border border-surface-border px-5 py-2.5 text-base font-medium text-muted transition hover:border-accent hover:text-accent"
        >
          Load more
        </FocusableButton>
      )}
    </div>
  );
}
