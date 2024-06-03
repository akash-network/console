"use client";
import { ReactNode, useState } from "react";
import { Learning, NavArrowDown, Rocket, SearchEngine } from "iconoir-react";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@src/components/ui/avatar";
import { Button } from "@src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@src/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@src/components/ui/collapsible";
import { cn } from "@src/utils/styleUtils";
import { UrlService } from "@src/utils/urlUtils";

type Props = {
  children?: ReactNode;
};

export const WelcomePanel: React.FC<Props> = () => {
  const [expanded, setExpanded] = useState(true);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl font-bold">Welcome to Akash Console!</CardTitle>

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
                  <Link href={UrlService.getStarted()}>Getting started with Akash Console</Link>
                  <span className="text-muted-foreground text-sm">Learn how to deploy your first docker container on Akash in a few click using Console.</span>
                </div>
              </li>

              <li className="flex items-center">
                <Avatar className="h-12 w-12">
                  <AvatarFallback>
                    <SearchEngine />
                  </AvatarFallback>
                </Avatar>

                <div className="ml-4 flex flex-col">
                  <Link href={UrlService.templates()}>Explore the marketplace</Link>
                  <span className="text-muted-foreground text-sm">
                    Browse through the marketplace of pre-made solutions with categories like blogs, blockchain nodes and more!
                  </span>
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
