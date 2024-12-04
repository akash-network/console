"use client"; // Error components must be Client Components

import { useEffect } from "react";
import { Button } from "@akashnetwork/ui/components";

import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { useLogger } from "@/hooks/useLogger";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const errorLogger = useLogger("apps/stats-web/src/app/error.tsx");
  useEffect(() => {
    // Log the error to an error reporting service
    errorLogger.debug(error);
  }, [error]);

  return (
    <PageContainer>
      <Title>Something went wrong!</Title>
      <Button
        className="my-4"
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
      >
        Try again
      </Button>
    </PageContainer>
  );
}
