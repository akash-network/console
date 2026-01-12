"use client";
import React, { useState } from "react";
import { Avatar, AvatarFallback, Button, Card, CardContent, Collapsible, CollapsibleContent, CollapsibleTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Cloud, Learning, NavArrowDown, Rocket } from "iconoir-react";
import Link from "next/link";

import { UrlService } from "@src/utils/urlUtils";

export const WelcomePanel: React.FC = () => {
  const [expanded, setExpanded] = useState(true);
  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-3xl font-semibold">Welcome to Akash Console!</h2>
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
                    Get Started with providing compute on Akash
                  </Link>
                  <span className="text-muted-foreground text-sm">Become a Akash Provider with simple and easy to follow steps.</span>
                </div>
              </li>
              <li className="flex items-center space-x-4">
                <Avatar className="h-12 w-12 rounded-md">
                  <AvatarFallback className="rounded-md">
                    <Cloud />
                  </AvatarFallback>
                </Avatar>

                <div className="flex flex-col">
                  <Link href="https://console.akash.network/providers" target="_blank" className="font-semibold">
                    Explore current Providers
                  </Link>
                  <span className="text-muted-foreground text-sm">View a map of current Providers on the network and their resources</span>
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
                  <span className="text-muted-foreground text-sm">Want to know about the advantages of using a decentralized cloud compute marketplace?</span>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
};
