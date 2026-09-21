"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <div className="panel flex max-w-md flex-col items-center gap-3 p-8 text-center">
        <p className="text-sm text-ink-300">Something went wrong</p>
        <p className="text-2xl font-medium text-ink-100">This page failed to load</p>
        <p className="text-sm text-ink-300">
          Usually a hiccup fetching live quotes or FX rates. Try again — if it keeps happening,
          the price provider may be rate-limiting; wait a minute and reload.
        </p>
        <button onClick={reset} className="btn-primary mt-2">
          Try again
        </button>
      </div>
    </div>
  );
}
