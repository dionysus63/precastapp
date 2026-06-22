"use client";

import { useState, useTransition, type MouseEvent } from "react";
import { toggleJobFavorite } from "@/app/jobs/actions";

type JobFavoriteStarProps = {
  jobId: string;
  initialFavorited: boolean;
};

export function JobFavoriteStar({
  jobId,
  initialFavorited,
}: JobFavoriteStarProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const nextFavorited = !favorited;
    setFavorited(nextFavorited);

    startTransition(async () => {
      try {
        const result = await toggleJobFavorite(jobId);
        setFavorited(result.favorited);
      } catch {
        setFavorited(!nextFavorited);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      className={`rounded p-1 transition-colors hover:bg-slate-100 disabled:opacity-60 ${
        favorited ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
      }`}
    >
      <svg
        viewBox="0 0 20 20"
        fill={favorited ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={favorited ? 0 : 1.5}
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.802 2.035a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.802-2.035a1 1 0 00-1.176 0l-2.802 2.035c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    </button>
  );
}
