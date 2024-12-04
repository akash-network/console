"use client"; // Error components must be Client Components

import { useEffect } from "react";

import { useLogger } from "@/hooks/useLogger";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const blockErrorLogger = useLogger("apps/stats-web/src/app/blocks/[height]/errors.tsx");
  useEffect(() => {
    // Log the error to an error reporting service
    blockErrorLogger.debug(error);
  }, [error]);

  return (
    <div>
      <h2>Something went wrong!</h2>
      <button
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
      >
        Try again
      </button>
    </div>
  );
}
