import { Alert, AlertDescription, AlertTitle } from "@akashnetwork/ui/components";
import { Book } from "iconoir-react";

import { ExternalLink } from "@src/components/shared/ExternalLink";

export function ApiKeyDocsBanner() {
  return (
    <Alert variant="default" className="border-primary/30 bg-primary/5">
      <Book className="h-5 w-5 text-primary" />
      <AlertTitle className="text-base font-semibold text-primary">Learn How to Use Your API Keys</AlertTitle>
      <AlertDescription>
        <p className="mb-2 text-muted-foreground">
          Discover how to integrate the Akash API into your applications. Our comprehensive documentation covers authentication, creating deployments, managing
          resources, and more.
        </p>
        <ExternalLink href="https://github.com/akash-network/console/wiki/Managed-wallet-API" text="View API Documentation" />
      </AlertDescription>
    </Alert>
  );
}
