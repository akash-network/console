"use client";
import React, { useState } from "react";
import { Avatar, AvatarFallback, Button, Card, CardContent, Collapsible, CollapsibleContent, CollapsibleTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Learning, NavArrowDown, Rocket, SearchEngine } from "iconoir-react";
import Link from "next/link";

import { UrlService } from "@src/utils/urlUtils";

export const WelcomePanel: React.FC = () => {
  const [expanded, setExpanded] = useState(true);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Welcome to Akash Console!</h2>
        <CollapsibleTrigger asChild>
          <Button size="icon" variant="ghost" className="!m-0 rounded-full" onClick={() => setExpanded(prev => !prev)}>
            <NavArrowDown fontSize="1rem" className={cn("transition-all duration-100", { ["rotate-180"]: expanded })} />
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <Card>
          <CardContent className="p-6">
            <ul className="space-y-6">
              <li className="flex items-center space-x-4">
                <Avatar className="h-12 w-12 rounded-md">
                  <AvatarFallback className="rounded-md">
                    <Rocket className="rotate-45" />
                  </AvatarFallback>
                </Avatar>

                <div className="flex flex-col">
                  <Link href={UrlService.getStarted()} className="font-semibold">
                    Getting started with Akash Console
                  </Link>
                  <span className="text-sm text-muted-foreground">Learn how to deploy your first docker container on Akash in a few clicks using Console.</span>
                </div>
              </li>

              <li className="flex items-center">
                <Avatar className="h-12 w-12 rounded-md">
                  <AvatarFallback className="rounded-md">
                    <SearchEngine />
                  </AvatarFallback>
                </Avatar>

                <div className="ml-4 flex flex-col">
                  <Link href={UrlService.templates()} className="font-semibold">
                    Explore the marketplace
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    Browse through the marketplace of pre-made solutions with categories like blogs, blockchain nodes and more!
                  </span>
                </div>
              </li>

              <li className="flex items-center">
                <Avatar className="h-12 w-12 rounded-md">
                  <AvatarFallback className="rounded-md">
                    <Learning />
                  </AvatarFallback>
                </Avatar>

                <div className="ml-4 flex flex-col">
                  <Link href="https://akash.network/docs/" target="_blank" className="font-semibold">
                    Learn more about Akash
                  </Link>
                  <span className="text-sm text-muted-foreground">Want to know about the advantages of using a decentralized cloud compute marketplace?</span>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
};
