"use client";
import { ReactNode, useState } from "react";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@src/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@src/@/components/ui/collapsible";
import { Expand, Rocket, SearchEngine, Learning } from "iconoir-react";
import { Button } from "@src/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@src/components/ui/avatar";

type Props = {
  children?: ReactNode;
};

export const WelcomePanel: React.FC<Props> = () => {
  const [expanded, setExpanded] = useState(true);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card>
        {/* <CardHeader
        title="Welcome to Cloudmos!"
        // titleTypographyProps={{ variant: "h3", sx: { fontSize: "1.25rem", fontWeight: "bold" } }}
        // sx={{ borderBottom: expanded ? `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[200]}` : "" }}
      >
<CardTitle>
Welcome to Cloudmos!
</CardTitle>


        </CardHeader> */}

        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl font-bold">Welcome to Akash Console!</CardTitle>

          <CollapsibleTrigger asChild>
            <Button size="icon" className="rounded-full !m-0" onClick={() => setExpanded(prev => !prev)}>
              <Expand />
            </Button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent
          // sx={{ padding: "0 !important" }}
          >
            <ul>
              <li className="flex items-center pb-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback>
                    <Rocket />
                  </AvatarFallback>
                </Avatar>

                <div className="ml-4 flex flex-col">
                  <Link href={UrlService.getStarted()}>Getting started with Akash Console</Link>
                  <span>Learn how to deploy your first docker container on Akash in a few click using Console.</span>
                </div>
              </li>

              <li className="flex items-center pb-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback>
                    <SearchEngine />
                  </AvatarFallback>
                </Avatar>

                <div className="ml-4 flex flex-col">
                  <Link href={UrlService.templates()}>Explore the marketplace</Link>
                  <span>Browse through the marketplace of pre-made solutions with categories like blogs, blockchain nodes and more!</span>
                </div>
              </li>

              <li className="flex items-center pb-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback>
                    <Learning />
                  </AvatarFallback>
                </Avatar>

                <div className="ml-4 flex flex-col">
                  <Link href="https://docs.akash.network/" target="_blank">
                    Learn more about Akash
                  </Link>
                  <span>Want to know about the advantages of using a decentralized cloud compute marketplace?</span>
                </div>
              </li>

              {/* <li>
              <Avatar>
                <CategoryIcon fontSize="large" />
              </Avatar>
              <ListItemText
                primary={<Link href={UrlService.templates()}>Explore the marketplace</Link>}
                secondary=""
              />
            </li> */}
              {/* <li>
              <Avatar>
                <SchoolIcon fontSize="large" />
              </Avatar>
              <ListItemText
                primary={
                  <a target="_blank" rel="noopener noreferrer" href="https://docs.akash.network/">
                    Learn more about Akash
                  </a>
                }
                secondary="Want to know about the advantages of using a decentralized cloud compute marketplace?"
              />
            </li> */}
            </ul>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
