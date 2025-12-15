"use client";
import React from "react";
import { Button, Card, CardContent } from "@akashnetwork/ui/components";
import { MultiplePages, Rocket } from "iconoir-react";
import Link from "next/link";

import { useServices } from "@src/context/ServicesProvider";

type Props = {
  onDeployClick: () => void;
};

export const NoDeploymentsState: React.FC<Props> = ({ onDeployClick }) => {
  const { urlService } = useServices();

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="mb-4 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border">
          <Rocket className="rotate-45 text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-xl font-bold">No current deployments</h3>
        <p className="mb-6 text-center text-muted-foreground">
          Use one of our most popular templates below or create your first deployment using our SDL builder.
        </p>
        <div className="flex gap-4">
          <Button onClick={onDeployClick} asChild>
            <Link href={urlService.newDeployment()}>
              <Rocket className="mr-2 h-4 w-4 rotate-45" />
              Create Deployment
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={urlService.templates()}>
              <MultiplePages className="mr-2 h-4 w-4" />
              Explore Templates
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
