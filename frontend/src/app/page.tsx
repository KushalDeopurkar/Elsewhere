import { Suspense } from "react";
import DiscoverView from "@/components/DiscoverView";
import { GridSkeleton } from "@/components/EventGrid";

/**
 * Discovery state lives in the URL, and `useSearchParams` suspends during
 * prerender, so the interactive view sits behind a Suspense boundary with a
 * matching skeleton.
 */
export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="shell" style={{ paddingTop: "4rem" }}>
          <GridSkeleton count={8} />
        </div>
      }
    >
      <DiscoverView />
    </Suspense>
  );
}
