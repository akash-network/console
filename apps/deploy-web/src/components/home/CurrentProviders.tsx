"use client";
import React from "react";
import { Badge, Card, CardContent, CardHeader } from "@akashnetwork/ui/components";
import Link from "next/link";

import { UrlService } from "@src/utils/urlUtils";

type Provider = {
  owner: string;
  name: string;
};

type Props = {
  providers: Provider[] | null;
};

export const CurrentProviders: React.FC<Props> = ({ providers }) => {
  if (!providers || providers.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-medium">Current Providers</h3>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {providers.map(p => (
            <Link key={p.owner} href={p.owner ? UrlService.providerDetailLeases(p.owner) : "#"}>
              <Badge variant="default" className="bg-primary/60 hover:bg-primary/80">
                {p.name}
              </Badge>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
