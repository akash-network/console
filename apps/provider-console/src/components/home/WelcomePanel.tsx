"use client";
import React from "react";
import { Avatar, AvatarFallback, Card, CardContent, CardHeader, CardTitle } from "@akashnetwork/ui/components";
import { Cloud, Learning, Rocket } from "iconoir-react";
import Link from "next/link";

import { UrlService } from "@src/utils/urlUtils";

export const WelcomePanel: React.FC = () => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-2xl font-bold">Welcome to Akash Provider Console!</CardTitle>
      </CardHeader>

      <CardContent>
        <ul className="space-y-6">
          <li className="flex items-center space-x-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback>
                <Rocket className="rotate-45" />
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col">
              <Link href={UrlService.getStarted()}>Get Started with providing compute on Akash</Link>
              <span className="text-muted-foreground text-sm">Become a Akash Provider with simple and easy to follow steps.</span>
            </div>
          </li>
          <li className="flex items-center space-x-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback>
                <Cloud />
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col">
              <Link href="https://console.akash.network/providers" target="_blank">
                Explore current Providers
              </Link>
              <span className="text-muted-foreground text-sm">View a map of current Providers on the network and their resources</span>
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
    </Card>
  );
};
