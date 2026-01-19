"use client";

import { useEffect } from "react";
import { LoggerService } from "@akashnetwork/logging";
import * as Sentry from "@sentry/nextjs";

const globalErrorLogger = new LoggerService({ name: "global-error" });

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    globalErrorLogger.error(error);
    // Capture error in Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h2>Something went wrong!</h2>
          <button
            onClick={() => reset()}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              cursor: "pointer"
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
