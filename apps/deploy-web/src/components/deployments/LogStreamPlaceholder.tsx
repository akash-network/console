"use client";
import { Button } from "@akashnetwork/ui/components";

import type { LOGS_MODE, LogStreamStatus } from "@src/hooks/useLogStream/useLogStream";

type Props = {
  mode: LOGS_MODE;
  status: Extract<LogStreamStatus, "silent" | "closed">;
  onRetry: () => void;
};

const SILENT_STREAM_COPY = {
  events: {
    title: "No recent events",
    description: "Providers keep Kubernetes events for about an hour, so older ones are already gone. New events appear here as they happen."
  },
  logs: {
    title: "No logs yet",
    description: "This service hasn't written any output yet. New lines appear here as they arrive."
  }
} satisfies Record<LOGS_MODE, { title: string; description: string }>;

const CLOSED_STREAM_COPY = {
  title: "Stream disconnected",
  description: "The connection to the provider ended."
};

export function LogStreamPlaceholder({ mode, status, onRetry }: Props) {
  const copy = status === "closed" ? CLOSED_STREAM_COPY : SILENT_STREAM_COPY[mode];

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background px-6 text-center">
      <p className="text-sm font-medium">{copy.title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{copy.description}</p>

      {status === "closed" && (
        <Button className="mt-2" variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function LogStreamDisconnectedBar({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3 py-2 text-sm text-muted-foreground">
      <span>{CLOSED_STREAM_COPY.title}</span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
