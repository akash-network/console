"use client";
import React, { useState } from "react";
import {
  Avatar,
  AvatarFallback,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Learning, NavArrowDown, Rocket } from "iconoir-react";
import Link from "next/link";

import { UrlService } from "@src/utils/urlUtils";

export const WelcomePanel: React.FC = () => {
  const [expanded, setExpanded] = useState(true);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl font-bold">Welcome to Akash Provider Console!</CardTitle>

          <CollapsibleTrigger asChild>
            <Button size="icon" variant="ghost" className="!m-0 rounded-full" onClick={() => setExpanded(prev => !prev)}>
              <NavArrowDown fontSize="1rem" className={cn("transition-all duration-100", { ["rotate-180"]: expanded })} />
            </Button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent>
            <ul className="space-y-6">
              <li className="flex items-center space-x-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback>
                    <Rocket className="rotate-45" />
                  </AvatarFallback>
                </Avatar>

                <div className="flex flex-col">
                  <Link href={UrlService.getStarted()}>Getting started with Akash Console Provider</Link>
                  <span className="text-muted-foreground text-sm">Become a Akash Provider with simple and easy to follow steps.</span>
                </div>
              </li>

              <li className="flex items-center">
                <Avatar className="h-12 w-12">
                  <AvatarFallback>
                    <Learning />
                  </AvatarFallback>
                </Avatar>

                <div className="ml-4 flex flex-col">
                  <Link href="https://akash.network/docs/" target="_blank">
                    Learn more about Akash
                  </Link>
                  <span className="text-muted-foreground text-sm">Want to know about the advantages of using a decentralized cloud compute marketplace?</span>
                </div>
              </li>
            </ul>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
