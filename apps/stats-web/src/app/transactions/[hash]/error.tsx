"use client"; // Error components must be Client Components

import { useEffect } from "react";
import { Button } from "@akashnetwork/ui/components";

import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
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
