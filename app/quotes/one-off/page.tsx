import { permanentRedirect } from "next/navigation";
import { QUICK_BUILD_PATH } from "@/lib/quotes/quick-build-links";

type OldOneOffPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * One-Off Drill Sheets became Quick Build. Old links and bookmarks (including
 * `?draft=` and `?edit=` ones) land on the new page with their query intact.
 */
export default async function OneOffRedirectPage({
  searchParams,
}: OldOneOffPageProps) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first) {
      params.set(key, first);
    }
  }
  const search = params.toString();
  permanentRedirect(search ? `${QUICK_BUILD_PATH}?${search}` : QUICK_BUILD_PATH);
}
